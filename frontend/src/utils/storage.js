import {
  initialBookingPassengers,
  initialBookings,
  initialCancellations,
  initialLocations,
  initialOperators,
  initialPassengers,
  initialPayments,
  initialRouteStops,
  initialRoutes,
  initialSchedules,
  initialTravelModes,
  initialUsers,
  initialVehicles
} from "../data/mockData";

const defaults = {
  users: initialUsers,
  travel_mode: initialTravelModes,
  operator: initialOperators,
  location: initialLocations,
  passenger: initialPassengers,
  vehicle: initialVehicles,
  route: initialRoutes,
  route_stop: initialRouteStops,
  schedule: initialSchedules,
  booking: initialBookings,
  booking_passenger: initialBookingPassengers,
  payment: initialPayments,
  cancellation: initialCancellations
};

export function seedStorage() {
  Object.entries(defaults).forEach(([key, value]) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });
}

export function readStorage(key) {
  seedStorage();
  return JSON.parse(localStorage.getItem(key) || "[]");
}

export function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function generateId(prefix) {
  return Number(`${Date.now()}`.slice(-8));
}

export function nextNumericId(collection, key) {
  return collection.length ? Math.max(...collection.map((item) => Number(item[key]) || 0)) + 1 : 1;
}
