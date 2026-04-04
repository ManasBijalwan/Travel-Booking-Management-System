import apiClient from "../api/client";
import { nextNumericId, readStorage, writeStorage } from "../utils/storage";

const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getTables() {
  return {
    users: readStorage("users"),
    modes: readStorage("travel_mode"),
    operators: readStorage("operator"),
    locations: readStorage("location"),
    passengers: readStorage("passenger"),
    vehicles: readStorage("vehicle"),
    routes: readStorage("route"),
    routeStops: readStorage("route_stop"),
    schedules: readStorage("schedule"),
    bookings: readStorage("booking"),
    bookingPassengers: readStorage("booking_passenger"),
    payments: readStorage("payment"),
    cancellations: readStorage("cancellation")
  };
}

function byId(collection, key, value) {
  return collection.find((item) => String(item[key]) === String(value));
}

function toDatePart(dateTime) {
  return String(dateTime).slice(0, 10);
}

function toTimePart(dateTime) {
  return String(dateTime).slice(11, 16);
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString("en-IN");
}

function buildSeatMap(totalSeats) {
  const seats = [];
  const safeSeats = Number(totalSeats) || 0;

  for (let index = 0; index < safeSeats; index += 1) {
    const row = String.fromCharCode(65 + Math.floor(index / 4));
    const number = (index % 4) + 1;
    seats.push(`${row}${number}`);
  }

  const rows = [];
  for (let index = 0; index < seats.length; index += 4) {
    rows.push(seats.slice(index, index + 4));
  }

  return rows;
}

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getRouteWindow(route, schedule) {
  const defaultStart = toDatePart(schedule?.departure_datetime || new Date().toISOString());
  return {
    bookingStartDate: route?.booking_start_date || defaultStart,
    bookingEndDate: route?.booking_end_date || addDays(defaultStart, 9)
  };
}

function getServiceDays(route) {
  return route?.service_days?.length ? route.service_days : weekDays;
}

function getRoutePath(route, tables, schedule) {
  const start = byId(tables.locations, "location_id", route?.start_location_id);
  const end = byId(tables.locations, "location_id", route?.end_location_id);
  const stops = tables.routeStops
    .filter((stop) => String(stop.route_id) === String(route?.route_id))
    .sort((a, b) => a.stop_sequence - b.stop_sequence)
    .map((stop) => {
      const location = byId(tables.locations, "location_id", stop.location_id);
      return {
        location_id: stop.location_id,
        location_name: location?.location_name || "",
        city: location?.city || "",
        arrival_time: stop.arrival_time || "",
        departure_time: stop.departure_time || "",
        isStop: true
      };
    });

  return [
    {
      location_id: route?.start_location_id,
      location_name: start?.location_name || "",
      city: start?.city || "",
      arrival_time: "",
      departure_time: schedule ? toTimePart(schedule.departure_datetime) : "",
      isStop: false
    },
    ...stops,
    {
      location_id: route?.end_location_id,
      location_name: end?.location_name || "",
      city: end?.city || "",
      arrival_time: schedule ? toTimePart(schedule.arrival_datetime) : "",
      departure_time: "",
      isStop: false
    }
  ];
}

function locationMatches(location, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [location.location_name, location.city]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function findLeg(route, schedule, tables, filters) {
  const path = getRoutePath(route, tables, schedule);
  const originIndex = filters.origin
    ? path.findIndex((location) => locationMatches(location, filters.origin))
    : 0;
  const destinationIndex = filters.destination
    ? path.findIndex((location) => locationMatches(location, filters.destination))
    : path.length - 1;

  if (originIndex === -1 || destinationIndex === -1 || originIndex >= destinationIndex) {
    return null;
  }

  return {
    origin: path[originIndex],
    destination: path[destinationIndex],
    path,
    amenities: path.slice(originIndex + 1, destinationIndex).map((location) => location.city || location.location_name)
  };
}

function buildTravelView(schedule, tables, overrides = {}) {
  const route = byId(tables.routes, "route_id", schedule.route_id);
  const vehicle = byId(tables.vehicles, "vehicle_id", schedule.vehicle_id);
  const mode = byId(tables.modes, "mode_id", route?.mode_id);
  const operator = byId(tables.operators, "operator_id", route?.operator_id);
  const start = byId(tables.locations, "location_id", route?.start_location_id);
  const end = byId(tables.locations, "location_id", route?.end_location_id);
  const routeStops = tables.routeStops
    .filter((stop) => String(stop.route_id) === String(route?.route_id))
    .sort((a, b) => a.stop_sequence - b.stop_sequence)
    .map((stop) => byId(tables.locations, "location_id", stop.location_id)?.city)
    .filter(Boolean);
  const window = getRouteWindow(route, schedule);

  return {
    id: schedule.schedule_id,
    schedule_id: schedule.schedule_id,
    route_id: route?.route_id,
    vehicle_id: vehicle?.vehicle_id,
    type: mode?.mode_name || "travel",
    name: vehicle?.vehicle_name || route?.route_name,
    operatorName: operator?.operator_name || "",
    origin: overrides.origin || start?.city || "",
    destination: overrides.destination || end?.city || "",
    originLocationId: overrides.originLocationId ?? route?.start_location_id,
    destinationLocationId: overrides.destinationLocationId ?? route?.end_location_id,
    departureDate: overrides.departureDate || toDatePart(schedule.departure_datetime),
    departureTime: overrides.departureTime || toTimePart(schedule.departure_datetime),
    arrivalTime: overrides.arrivalTime || toTimePart(schedule.arrival_datetime),
    duration: formatDuration(route?.total_duration_min || 0),
    price: schedule.base_fare,
    seatsAvailable: schedule.available_seats,
    vehicleCode: vehicle?.vehicle_number,
    routeCode: route?.route_name,
    amenities: overrides.amenities || (routeStops.length ? routeStops : [mode?.mode_name || "travel"]),
    seatMap: buildSeatMap(vehicle?.total_seats),
    status: schedule.status,
    serviceDays: getServiceDays(route),
    bookingStartDate: window.bookingStartDate,
    bookingEndDate: window.bookingEndDate
  };
}

function buildBookingView(booking, tables) {
  const schedule = byId(tables.schedules, "schedule_id", booking.schedule_id);
  const travel = schedule
    ? buildTravelView(schedule, tables, {
        originLocationId: booking.boarding_location_id,
        destinationLocationId: booking.dropping_location_id,
        origin: byId(tables.locations, "location_id", booking.boarding_location_id)?.city || "",
        destination: byId(tables.locations, "location_id", booking.dropping_location_id)?.city || ""
      })
    : null;
  const bookingPassengerRows = tables.bookingPassengers.filter(
    (item) => String(item.booking_id) === String(booking.booking_id)
  );
  const passengers = bookingPassengerRows.map((row) => {
    const passenger = byId(tables.passengers, "passenger_id", row.passenger_id);
    return {
      passenger_name: passenger?.passenger_name || "",
      age: passenger?.age || "",
      gender: passenger?.gender || "",
      id_proof_number: passenger?.id_proof_number || "",
      fullName: passenger?.passenger_name || "",
      idProofNumber: passenger?.id_proof_number || ""
    };
  });
  const selectedSeats = bookingPassengerRows.map((row) => row.seat_id).filter(Boolean);
  const payment = tables.payments.find((item) => String(item.booking_id) === String(booking.booking_id));
  const cancellation = tables.cancellations.find(
    (item) => String(item.booking_id) === String(booking.booking_id)
  );

  return {
    id: booking.booking_id,
    booking_id: booking.booking_id,
    status: booking.booking_status,
    bookedAt: booking.booking_date,
    totalAmount: booking.total_amount,
    totalAmountLabel: formatCurrency(booking.total_amount),
    paymentStatus: payment?.payment_status || "Pending",
    passengers,
    selectedSeats,
    travel,
    pnr: booking.pnr_number,
    boardingLocationId: booking.boarding_location_id,
    droppingLocationId: booking.dropping_location_id,
    cancellation
  };
}

function buildCancellationView(cancellation, tables) {
  const booking = byId(tables.bookings, "booking_id", cancellation.booking_id);
  const bookingView = booking ? buildBookingView(booking, tables) : null;
  return {
    id: cancellation.cancellation_id,
    bookingId: cancellation.booking_id,
    cancellationDate: cancellation.cancellation_date,
    refundAmount: cancellation.refund_amount,
    refundAmountLabel: formatCurrency(cancellation.refund_amount),
    reason: cancellation.cancellation_reason,
    refundStatus: cancellation.refund_status,
    travelName: bookingView?.travel?.name || "",
    route: bookingView?.travel ? `${bookingView.travel.origin} to ${bookingView.travel.destination}` : "",
    pnr: bookingView?.pnr || ""
  };
}

export async function searchTravels(filters = {}) {
  try {
    const response = await apiClient.get("/travels", { params: filters });
    return response.data;
  } catch (error) {
    const tables = getTables();
    return tables.schedules
      .filter((schedule) => schedule.status === "active")
      .map((schedule) => {
        const route = byId(tables.routes, "route_id", schedule.route_id);
        const leg = findLeg(route, schedule, tables, filters);
        if (!route || !leg) {
          return null;
        }

        const travel = buildTravelView(schedule, tables, {
          origin: leg.origin.city || leg.origin.location_name,
          destination: leg.destination.city || leg.destination.location_name,
          originLocationId: leg.origin.location_id,
          destinationLocationId: leg.destination.location_id,
          departureTime: leg.origin.departure_time || toTimePart(schedule.departure_datetime),
          arrivalTime: leg.destination.arrival_time || toTimePart(schedule.arrival_datetime),
          amenities: leg.amenities.length ? leg.amenities : [byId(tables.modes, "mode_id", route.mode_id)?.mode_name || "travel"]
        });

        return { travel, route };
      })
      .filter(Boolean)
      .map(({ travel, route }) => ({ travel, route, window: getRouteWindow(route, byId(tables.schedules, "schedule_id", travel.id)) }))
      .filter(({ travel, route, window }) => {
        const typeMatch = !filters.type || travel.type.toLowerCase() === String(filters.type).toLowerCase();
        const dateValue = filters.departureDate || travel.departureDate;
        const withinWindow = !filters.departureDate || (dateValue >= window.bookingStartDate && dateValue <= window.bookingEndDate);
        const dayName = weekDays[new Date(dateValue).getDay()];
        const serviceMatch = !filters.departureDate || getServiceDays(route).includes(dayName);
        return typeMatch && withinWindow && serviceMatch;
      })
      .map(({ travel }) =>
        filters.departureDate ? { ...travel, departureDate: filters.departureDate } : travel
      );
  }
}

export async function getTravelById(id) {
  try {
    const response = await apiClient.get(`/travels/${id}`);
    return response.data;
  } catch (error) {
    const tables = getTables();
    const schedule = byId(tables.schedules, "schedule_id", id);
    return schedule ? buildTravelView(schedule, tables) : null;
  }
}

export async function createBooking(payload) {
  try {
    const response = await apiClient.post("/bookings", payload);
    return response.data;
  } catch (error) {
    const tables = getTables();
    const schedule = byId(tables.schedules, "schedule_id", payload.travelId);
    const travel = buildTravelView(schedule, tables, {
      originLocationId: payload.boardingLocationId,
      destinationLocationId: payload.droppingLocationId
    });
    const bookingId = nextNumericId(tables.bookings, "booking_id");
    const passengerStartId = nextNumericId(tables.passengers, "passenger_id");

    const passengerRows = payload.passengers.map((passenger, index) => ({
      passenger_id: passengerStartId + index,
      user_id: payload.userId,
      passenger_name: passenger.passenger_name,
      age: Number(passenger.age),
      gender: passenger.gender,
      id_proof_type: "Self Declared",
      id_proof_number: passenger.id_proof_number
    }));

    const booking = {
      booking_id: bookingId,
      user_id: payload.userId,
      schedule_id: payload.travelId,
      boarding_location_id: payload.boardingLocationId || travel.originLocationId,
      dropping_location_id: payload.droppingLocationId || travel.destinationLocationId,
      booking_date: new Date().toISOString(),
      pnr_number: `PNR${bookingId}${Date.now().toString().slice(-4)}`,
      total_amount: payload.totalAmount,
      booking_status: "Confirmed"
    };

    const bookingPassengerRows = payload.selectedSeats.map((seatCode, index) => ({
      booking_id: bookingId,
      passenger_id: passengerRows[index].passenger_id,
      seat_id: seatCode,
      fare: schedule.base_fare
    }));

    const payment = {
      payment_id: nextNumericId(tables.payments, "payment_id"),
      booking_id: bookingId,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: payload.payment.method,
      amount_paid: payload.totalAmount,
      payment_status: "Paid",
      transaction_ref: `TXN${Date.now()}`
    };

    const updatedSchedules = tables.schedules.map((item) =>
      String(item.schedule_id) === String(payload.travelId)
        ? { ...item, available_seats: Math.max(item.available_seats - payload.selectedSeats.length, 0) }
        : item
    );
    const updatedPassengers = [...tables.passengers, ...passengerRows];
    const updatedBookings = [...tables.bookings, booking];
    const updatedBookingPassengers = [...tables.bookingPassengers, ...bookingPassengerRows];
    const updatedPayments = [...tables.payments, payment];

    writeStorage("passenger", updatedPassengers);
    writeStorage("booking", updatedBookings);
    writeStorage("booking_passenger", updatedBookingPassengers);
    writeStorage("payment", updatedPayments);
    writeStorage("schedule", updatedSchedules);

    return buildBookingView(booking, {
      ...tables,
      passengers: updatedPassengers,
      bookings: updatedBookings,
      bookingPassengers: updatedBookingPassengers,
      payments: updatedPayments,
      schedules: updatedSchedules
    });
  }
}

export async function getBookingsByUser(userId) {
  try {
    const response = await apiClient.get(`/bookings/user/${userId}`);
    return response.data;
  } catch (error) {
    const tables = getTables();
    return tables.bookings
      .filter((booking) => String(booking.user_id) === String(userId))
      .map((booking) => buildBookingView(booking, tables));
  }
}

export async function getCancellationsByUser(userId) {
  const tables = getTables();
  const userBookingIds = tables.bookings
    .filter((booking) => String(booking.user_id) === String(userId))
    .map((booking) => booking.booking_id);

  return tables.cancellations
    .filter((cancellation) => userBookingIds.includes(cancellation.booking_id))
    .map((cancellation) => buildCancellationView(cancellation, tables));
}

export async function cancelBooking(bookingId) {
  try {
    const response = await apiClient.patch(`/bookings/${bookingId}/cancel`);
    return response.data;
  } catch (error) {
    const tables = getTables();
    const bookingPassengerRows = tables.bookingPassengers.filter(
      (row) => String(row.booking_id) === String(bookingId)
    );
    const booking = byId(tables.bookings, "booking_id", bookingId);

    const updatedBookings = tables.bookings.map((item) =>
      String(item.booking_id) === String(bookingId)
        ? { ...item, booking_status: "Cancelled" }
        : item
    );
    const updatedSchedules = tables.schedules.map((item) =>
      String(item.schedule_id) === String(booking?.schedule_id)
        ? { ...item, available_seats: item.available_seats + bookingPassengerRows.length }
        : item
    );
    const updatedPayments = tables.payments.map((item) =>
      String(item.booking_id) === String(bookingId)
        ? { ...item, payment_status: "Refund Pending" }
        : item
    );
    const cancellation = {
      cancellation_id: nextNumericId(tables.cancellations, "cancellation_id"),
      booking_id: Number(bookingId),
      cancellation_date: new Date().toISOString().slice(0, 10),
      refund_amount: booking?.total_amount || 0,
      cancellation_reason: "Cancelled by user",
      refund_status: "Initiated"
    };

    writeStorage("booking", updatedBookings);
    writeStorage("schedule", updatedSchedules);
    writeStorage("payment", updatedPayments);
    writeStorage("cancellation", [...tables.cancellations, cancellation]);

    return buildBookingView(byId(updatedBookings, "booking_id", bookingId), {
      ...tables,
      bookings: updatedBookings,
      schedules: updatedSchedules,
      payments: updatedPayments,
      cancellations: [...tables.cancellations, cancellation]
    });
  }
}

export async function getAdminOverview() {
  try {
    const response = await apiClient.get("/admin/overview");
    return response.data;
  } catch (error) {
    const tables = getTables();
    const totalRevenue = tables.payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
    const totalReimbursement = tables.cancellations.reduce((sum, item) => sum + Number(item.refund_amount || 0), 0);
    return {
      metrics: [
        { label: "Users", value: tables.users.length },
        { label: "Operators", value: tables.operators.length },
        { label: "Locations", value: tables.locations.length },
        { label: "Revenue", value: formatCurrency(totalRevenue) },
        { label: "Total Reimbursement", value: formatCurrency(totalReimbursement) }
      ],
      bookings: tables.bookings.map((booking) => buildBookingView(booking, tables)),
      payments: tables.payments.map((payment) => ({
        id: payment.payment_id,
        method: payment.payment_method,
        status: payment.payment_status,
        amount: payment.amount_paid,
        amountLabel: formatCurrency(payment.amount_paid)
      })),
      cancellations: tables.cancellations.map((cancellation) => buildCancellationView(cancellation, tables))
    };
  }
}

export async function getAdminResource(resourceKey) {
  try {
    const response = await apiClient.get(`/admin/${resourceKey}`);
    return response.data;
  } catch (error) {
    const tables = getTables();

    if (resourceKey === "operators") {
      return tables.operators.map((operator) => ({
        id: operator.operator_id,
        operator_name: operator.operator_name,
        mode_type: byId(tables.modes, "mode_id", operator.mode_id)?.mode_name || "",
        contact_email: operator.contact_email,
        contact_phone: operator.contact_phone
      }));
    }

    if (resourceKey === "locations") {
      return tables.locations.map((location) => ({
        id: location.location_id,
        location_name: location.location_name,
        city: location.city,
        state: location.state,
        country: location.country,
        location_type: location.location_type
      }));
    }

    if (resourceKey === "vehicles") {
      return tables.vehicles.map((vehicle) => ({
        id: vehicle.vehicle_id,
        vehicle_id: vehicle.vehicle_id,
        mode_id: vehicle.mode_id,
        operator_id: vehicle.operator_id,
        vehicle_number: vehicle.vehicle_number,
        vehicle_name: vehicle.vehicle_name,
        total_seats: vehicle.total_seats,
        status: vehicle.status
      }));
    }

    if (resourceKey === "routes") {
      return tables.routes.map((route) => {
        const vehicleSchedule = tables.schedules.find(
          (schedule) => String(schedule.route_id) === String(route.route_id)
        );
        const vehicle = byId(tables.vehicles, "vehicle_id", vehicleSchedule?.vehicle_id);
        const start = byId(tables.locations, "location_id", route.start_location_id);
        const end = byId(tables.locations, "location_id", route.end_location_id);
        const stops = tables.routeStops
          .filter((stop) => String(stop.route_id) === String(route.route_id))
          .sort((a, b) => a.stop_sequence - b.stop_sequence)
          .map((stop) => {
            const location = byId(tables.locations, "location_id", stop.location_id);
            return {
              route_stop_id: stop.route_stop_id,
              location_id: String(stop.location_id),
              location_name: location?.location_name || "",
              city: location?.city || "",
              arrival_time: stop.arrival_time || "",
              departure_time: stop.departure_time || ""
            };
          });
        const window = getRouteWindow(route, vehicleSchedule);

        return {
          id: route.route_id,
          mode_id: String(route.mode_id),
          mode_type: byId(tables.modes, "mode_id", route.mode_id)?.mode_name || "",
          origin: String(route.start_location_id),
          origin_name: start ? `${start.location_name} - ${start.city}` : "",
          destination: String(route.end_location_id),
          destination_name: end ? `${end.location_name} - ${end.city}` : "",
          arrivalTime: vehicleSchedule ? toTimePart(vehicleSchedule.arrival_datetime) : "",
          departureTime: vehicleSchedule ? toTimePart(vehicleSchedule.departure_datetime) : "",
          operator_id: String(route.operator_id),
          operator_name: byId(tables.operators, "operator_id", route.operator_id)?.operator_name || "",
          vehicle_id: vehicle ? String(vehicle.vehicle_id) : "",
          vehicle_name: vehicle?.vehicle_name || "",
          status: vehicleSchedule?.status || "active",
          serviceDays: getServiceDays(route),
          bookingStartDate: window.bookingStartDate,
          bookingEndDate: window.bookingEndDate,
          intermediateStops: stops
        };
      });
    }

    if (resourceKey === "bookings") {
      return tables.bookings.map((booking) => buildBookingView(booking, tables));
    }

    if (resourceKey === "payments") {
      return tables.payments.map((payment) => ({
        id: payment.payment_id,
        bookingId: payment.booking_id,
        method: payment.payment_method,
        status: payment.payment_status,
        amount: payment.amount_paid,
        amountLabel: formatCurrency(payment.amount_paid),
        date: payment.payment_date
      }));
    }

    if (resourceKey === "cancellations") {
      return tables.cancellations.map((cancellation) => buildCancellationView(cancellation, tables));
    }

    return [];
  }
}

export async function getVehicleFormOptions() {
  const tables = getTables();

  return {
    modes: tables.modes.map((mode) => ({
      value: String(mode.mode_id),
      label: `${mode.mode_id} - ${mode.mode_name}`
    })),
    operators: tables.operators.map((operator) => ({
      value: String(operator.operator_id),
      label: `${operator.operator_id} - ${operator.operator_name}`
    }))
  };
}

export async function getRouteFormOptions() {
  const tables = getTables();

  return {
    modes: tables.modes.map((mode) => ({
      value: String(mode.mode_id),
      label: mode.mode_name
    })),
    locations: tables.locations.map((location) => ({
      value: String(location.location_id),
      label: `${location.location_name} - ${location.city}`
    })),
    operators: tables.operators.map((operator) => ({
      value: String(operator.operator_id),
      label: `${operator.operator_id} - ${operator.operator_name}`
    })),
    vehicles: tables.vehicles.map((vehicle) => ({
      value: String(vehicle.vehicle_id),
      label: `${vehicle.vehicle_id} - ${vehicle.vehicle_name} (${vehicle.vehicle_number})`
    })),
    weekDays
  };
}

export async function upsertAdminResource(resourceKey, record) {
  try {
    const response = await apiClient.post(`/admin/${resourceKey}`, record);
    return response.data;
  } catch (error) {
    const tables = getTables();

    if (resourceKey === "operators") {
      const operatorId = record.id || nextNumericId(tables.operators, "operator_id");
      const mode = tables.modes.find((item) => item.mode_name === record.mode_type) || tables.modes[0];
      const nextOperator = {
        operator_id: operatorId,
        operator_name: record.operator_name,
        mode_id: mode.mode_id,
        contact_email: record.contact_email,
        contact_phone: record.contact_phone
      };
      const updated = [...tables.operators.filter((item) => item.operator_id !== operatorId), nextOperator];
      writeStorage("operator", updated);
      return nextOperator;
    }

    if (resourceKey === "locations") {
      const locationId = record.id || nextNumericId(tables.locations, "location_id");
      const nextLocation = {
        location_id: locationId,
        location_name: record.location_name,
        city: record.city,
        state: record.state,
        country: record.country,
        location_type: record.location_type
      };
      const updated = [...tables.locations.filter((item) => item.location_id !== locationId), nextLocation];
      writeStorage("location", updated);
      return nextLocation;
    }

    if (resourceKey === "vehicles") {
      const vehicleId = record.id || nextNumericId(tables.vehicles, "vehicle_id");
      const nextVehicle = {
        vehicle_id: vehicleId,
        mode_id: Number(record.mode_id),
        operator_id: Number(record.operator_id),
        vehicle_number: record.vehicle_number,
        vehicle_name: record.vehicle_name,
        total_seats: Number(record.total_seats || 0),
        status: record.status || "operational"
      };
      const updated = [...tables.vehicles.filter((item) => item.vehicle_id !== vehicleId), nextVehicle];
      writeStorage("vehicle", updated);
      return nextVehicle;
    }

    if (resourceKey === "routes") {
      const routeId = record.id || nextNumericId(tables.routes, "route_id");
      const nextStopId = nextNumericId(tables.routeStops, "route_stop_id");
      const existingRoute = tables.routes.find((item) => String(item.route_id) === String(routeId));
      const existingSchedule = tables.schedules.find((item) => String(item.route_id) === String(routeId));
      const route = {
        route_id: routeId,
        route_name: existingRoute?.route_name || `RT-${routeId}`,
        mode_id: Number(record.mode_id),
        operator_id: Number(record.operator_id),
        start_location_id: Number(record.origin),
        end_location_id: Number(record.destination),
        total_distance_km: existingRoute?.total_distance_km || 0,
        total_duration_min: existingRoute?.total_duration_min || 0,
        service_days: record.serviceDays?.length ? record.serviceDays : weekDays,
        booking_start_date: record.bookingStartDate,
        booking_end_date: record.bookingEndDate
      };
      const updatedRoutes = [...tables.routes.filter((item) => item.route_id !== routeId), route];
      const updatedStops = [
        ...tables.routeStops.filter((item) => String(item.route_id) !== String(routeId)),
        ...(record.intermediateStops || []).map((stop, index) => ({
          route_stop_id: stop.route_stop_id || nextStopId + index,
          route_id: routeId,
          location_id: Number(stop.location_id),
          stop_sequence: index + 1,
          arrival_offset_min: 0,
          departure_offset_min: 0,
          halt_minutes: 0,
          arrival_time: stop.arrival_time,
          departure_time: stop.departure_time
        }))
      ];
      const scheduleDate = record.bookingStartDate || existingSchedule?.departure_datetime?.slice(0, 10) || new Date().toISOString().slice(0, 10);
      const updatedSchedules = [
        ...tables.schedules.filter((item) => String(item.route_id) !== String(routeId)),
        {
          schedule_id: existingSchedule?.schedule_id || nextNumericId(tables.schedules, "schedule_id"),
          vehicle_id: Number(record.vehicle_id),
          route_id: routeId,
          departure_datetime: `${scheduleDate}T${record.departureTime || "00:00"}:00`,
          arrival_datetime: `${scheduleDate}T${record.arrivalTime || "00:00"}:00`,
          base_fare: existingSchedule?.base_fare || 0,
          available_seats:
            existingSchedule?.available_seats ||
            byId(tables.vehicles, "vehicle_id", Number(record.vehicle_id))?.total_seats ||
            0,
          status: record.status || existingSchedule?.status || "active"
        }
      ];
      writeStorage("route", updatedRoutes);
      writeStorage("route_stop", updatedStops);
      writeStorage("schedule", updatedSchedules);
      return route;
    }

    return record;
  }
}

export async function deleteAdminResource(resourceKey, recordId) {
  try {
    const response = await apiClient.delete(`/admin/${resourceKey}/${recordId}`);
    return response.data;
  } catch (error) {
    const tables = getTables();

    if (resourceKey === "operators") {
      writeStorage("operator", tables.operators.filter((item) => String(item.operator_id) !== String(recordId)));
      return { success: true };
    }

    if (resourceKey === "locations") {
      const impactedRouteIds = tables.routes
        .filter(
          (route) =>
            String(route.start_location_id) === String(recordId) ||
            String(route.end_location_id) === String(recordId) ||
            tables.routeStops.some(
              (stop) =>
                String(stop.route_id) === String(route.route_id) &&
                String(stop.location_id) === String(recordId)
            )
        )
        .map((route) => route.route_id);
      writeStorage("location", tables.locations.filter((item) => String(item.location_id) !== String(recordId)));
      writeStorage("route", tables.routes.filter((item) => !impactedRouteIds.includes(item.route_id)));
      writeStorage(
        "route_stop",
        tables.routeStops.filter(
          (item) =>
            String(item.location_id) !== String(recordId) && !impactedRouteIds.includes(item.route_id)
        )
      );
      writeStorage("schedule", tables.schedules.filter((item) => !impactedRouteIds.includes(item.route_id)));
      return { success: true };
    }

    if (resourceKey === "vehicles") {
      writeStorage("vehicle", tables.vehicles.filter((item) => String(item.vehicle_id) !== String(recordId)));
      writeStorage("schedule", tables.schedules.filter((item) => String(item.vehicle_id) !== String(recordId)));
      return { success: true };
    }

    if (resourceKey === "routes") {
      writeStorage("route", tables.routes.filter((item) => String(item.route_id) !== String(recordId)));
      writeStorage("route_stop", tables.routeStops.filter((item) => String(item.route_id) !== String(recordId)));
      writeStorage("schedule", tables.schedules.filter((item) => String(item.route_id) !== String(recordId)));
      return { success: true };
    }

    if (resourceKey === "bookings") {
      writeStorage("booking", tables.bookings.filter((item) => String(item.booking_id) !== String(recordId)));
      writeStorage(
        "booking_passenger",
        tables.bookingPassengers.filter((item) => String(item.booking_id) !== String(recordId))
      );
      writeStorage("payment", tables.payments.filter((item) => String(item.booking_id) !== String(recordId)));
      writeStorage("cancellation", tables.cancellations.filter((item) => String(item.booking_id) !== String(recordId)));
      return { success: true };
    }

    return { success: true };
  }
}
