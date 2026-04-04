export const initialUsers = [
  {
    user_id: 1,
    full_name: "Admin Operator",
    email: "admin@travelhub.com",
    phone: "9000000001",
    password_hash: "admin123",
    role: "admin",
    created_at: "2026-04-01T09:00:00",
    status: "active"
  },
  {
    user_id: 2,
    full_name: "Maya Kapoor",
    email: "user@travelhub.com",
    phone: "9000000002",
    password_hash: "user123",
    role: "user",
    created_at: "2026-04-01T10:00:00",
    status: "active"
  }
];

export const initialTravelModes = [
  { mode_id: 1, mode_name: "Train" },
  { mode_id: 2, mode_name: "Bus" },
  { mode_id: 3, mode_name: "Flight" }
];

export const initialOperators = [
  { operator_id: 1, operator_name: "Indian Railways", mode_id: 1, contact_email: "ops@railways.com", contact_phone: "8000000001" },
  { operator_id: 2, operator_name: "InterCity Mobility", mode_id: 2, contact_email: "ops@intercity.com", contact_phone: "8000000002" },
  { operator_id: 3, operator_name: "SkyLink Airways", mode_id: 3, contact_email: "ops@skylink.com", contact_phone: "8000000003" }
];

export const initialLocations = [
  { location_id: 1, location_name: "New Delhi Junction", city: "Delhi", state: "Delhi", country: "India", location_type: "Railway Station" },
  { location_id: 2, location_name: "Mumbai Central", city: "Mumbai", state: "Maharashtra", country: "India", location_type: "Railway Station" },
  { location_id: 3, location_name: "Bengaluru Bus Terminal", city: "Bengaluru", state: "Karnataka", country: "India", location_type: "Bus Stand" },
  { location_id: 4, location_name: "Chennai Mofussil Bus Terminus", city: "Chennai", state: "Tamil Nadu", country: "India", location_type: "Bus Stand" },
  { location_id: 5, location_name: "Rajiv Gandhi International Airport", city: "Hyderabad", state: "Telangana", country: "India", location_type: "Airport" },
  { location_id: 6, location_name: "Goa International Airport", city: "Goa", state: "Goa", country: "India", location_type: "Airport" },
  { location_id: 7, location_name: "Kota Junction", city: "Kota", state: "Rajasthan", country: "India", location_type: "Railway Station" },
  { location_id: 8, location_name: "Vadodara Junction", city: "Vadodara", state: "Gujarat", country: "India", location_type: "Railway Station" },
  { location_id: 9, location_name: "Surat Junction", city: "Surat", state: "Gujarat", country: "India", location_type: "Railway Station" },
  { location_id: 10, location_name: "Krishnagiri Stop", city: "Krishnagiri", state: "Tamil Nadu", country: "India", location_type: "Bus Stand" },
  { location_id: 11, location_name: "Vellore Stop", city: "Vellore", state: "Tamil Nadu", country: "India", location_type: "Bus Stand" }
];

export const initialPassengers = [
  { passenger_id: 1, user_id: 2, passenger_name: "Maya Kapoor", age: 29, gender: "Female", id_proof_type: "Aadhaar", id_proof_number: "AADH1234" },
  { passenger_id: 2, user_id: 2, passenger_name: "Rohan Kapoor", age: 31, gender: "Male", id_proof_type: "Passport", id_proof_number: "PASS5678" }
];

export const initialVehicles = [
  { vehicle_id: 1, mode_id: 1, operator_id: 1, vehicle_number: "TR-11", vehicle_name: "Rajdhani Express", total_seats: 12, status: "active" },
  { vehicle_id: 2, mode_id: 2, operator_id: 2, vehicle_number: "BS-08", vehicle_name: "InterCity Volvo", total_seats: 12, status: "active" },
  { vehicle_id: 3, mode_id: 3, operator_id: 3, vehicle_number: "FL-22", vehicle_name: "SkyLink Airways", total_seats: 16, status: "active" }
];

export const initialRoutes = [
  { route_id: 1, route_name: "NDLS-BCT", mode_id: 1, operator_id: 1, start_location_id: 1, end_location_id: 2, total_distance_km: 1384, total_duration_min: 705 },
  { route_id: 2, route_name: "BLR-MAA", mode_id: 2, operator_id: 2, start_location_id: 3, end_location_id: 4, total_distance_km: 346, total_duration_min: 510 },
  { route_id: 3, route_name: "HYD-GOI", mode_id: 3, operator_id: 3, start_location_id: 5, end_location_id: 6, total_distance_km: 530, total_duration_min: 80 }
];

export const initialRouteStops = [
  { route_stop_id: 1, route_id: 1, location_id: 7, stop_sequence: 1, arrival_offset_min: 240, departure_offset_min: 255, halt_minutes: 15 },
  { route_stop_id: 2, route_id: 1, location_id: 8, stop_sequence: 2, arrival_offset_min: 480, departure_offset_min: 495, halt_minutes: 15 },
  { route_stop_id: 3, route_id: 1, location_id: 9, stop_sequence: 3, arrival_offset_min: 615, departure_offset_min: 625, halt_minutes: 10 },
  { route_stop_id: 4, route_id: 2, location_id: 10, stop_sequence: 1, arrival_offset_min: 180, departure_offset_min: 190, halt_minutes: 10 },
  { route_stop_id: 5, route_id: 2, location_id: 11, stop_sequence: 2, arrival_offset_min: 300, departure_offset_min: 310, halt_minutes: 10 }
];

export const initialSchedules = [
  { schedule_id: 1, vehicle_id: 1, route_id: 1, departure_datetime: "2026-04-10T06:30:00", arrival_datetime: "2026-04-10T18:15:00", base_fare: 120, available_seats: 10, status: "active" },
  { schedule_id: 2, vehicle_id: 2, route_id: 2, departure_datetime: "2026-04-11T21:00:00", arrival_datetime: "2026-04-12T05:30:00", base_fare: 55, available_seats: 12, status: "active" },
  { schedule_id: 3, vehicle_id: 3, route_id: 3, departure_datetime: "2026-04-12T14:10:00", arrival_datetime: "2026-04-12T15:30:00", base_fare: 185, available_seats: 16, status: "active" }
];

export const initialBookings = [
  { booking_id: 1, user_id: 2, schedule_id: 1, boarding_location_id: 1, dropping_location_id: 2, booking_date: "2026-04-02T10:15:00", pnr_number: "PNR3001", total_amount: 240, booking_status: "Confirmed" }
];

export const initialBookingPassengers = [
  { booking_id: 1, passenger_id: 1, seat_id: "A1", fare: 120 },
  { booking_id: 1, passenger_id: 2, seat_id: "A2", fare: 120 }
];

export const initialPayments = [
  { payment_id: 1, booking_id: 1, payment_date: "2026-04-02", payment_method: "Card", amount_paid: 240, payment_status: "Paid", transaction_ref: "TXN9001" }
];

export const initialCancellations = [];
