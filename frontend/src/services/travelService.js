import apiClient from "../api/client";

// ─── User-facing travel queries ───────────────────────────────────────────────

export async function searchTravels(filters = {}) {
  const response = await apiClient.get("/travels", { params: filters });
  return response.data; // array of travel view objects
}

export async function getTravelById(id) {
  const response = await apiClient.get(`/travels/${id}`);
  return response.data; // single travel view object
}

// ─── Booking ──────────────────────────────────────────────────────────────────

export async function createBooking(payload) {
  // payload: { userId, travelId, boardingLocationId, droppingLocationId,
  //            passengers, selectedSeats, totalAmount, payment }
  const response = await apiClient.post("/bookings", payload);
  return response.data; // booking view object
}

export async function getBookingsByUser(userId) {
  const response = await apiClient.get(`/bookings/user/${userId}`);
  return response.data; // array of booking view objects
}

export async function cancelBooking(bookingId) {
  const response = await apiClient.patch(`/bookings/${bookingId}/cancel`);
  return response.data;
}

// ─── Cancellations ────────────────────────────────────────────────────────────

export async function getCancellationsByUser(userId) {
  const response = await apiClient.get(`/cancellations/user/${userId}`);
  return response.data; // array of cancellation view objects
}
