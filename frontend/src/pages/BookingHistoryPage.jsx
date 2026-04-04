import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { cancelBooking, getBookingsByUser, getCancellationsByUser } from "../services/travelService";

function BookingHistoryPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [cancellations, setCancellations] = useState([]);

  const loadBookings = async () => {
    const [bookingResult, cancellationResult] = await Promise.all([
      getBookingsByUser(user.id),
      getCancellationsByUser(user.id)
    ]);
    setBookings(bookingResult);
    setCancellations(cancellationResult);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancel = async (bookingId) => {
    await cancelBooking(bookingId);
    await loadBookings();
  };

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">My Trips</p>
          <h1>Booking history and cancellations</h1>
        </div>
      </div>

      <div className="history-list">
        {bookings.map((booking) => (
          <article key={booking.id} className="panel history-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{booking.id}</p>
                <h3>{booking.travel?.name}</h3>
                <p>
                  {booking.travel?.origin} to {booking.travel?.destination}
                </p>
              </div>
              <span className={`status-badge ${booking.status.toLowerCase()}`}>
                {booking.status}
              </span>
            </div>

            <div className="meta-grid">
              <span>Seats: {booking.selectedSeats.join(", ")}</span>
              <span>Passengers: {booking.passengers.length}</span>
              <span>Total: {booking.totalAmountLabel}</span>
              <span>Payment: {booking.paymentStatus}</span>
            </div>

            {booking.status !== "Cancelled" && (
              <button
                type="button"
                className="ghost-button danger"
                onClick={() => handleCancel(booking.id)}
              >
                Cancel Booking
              </button>
            )}
          </article>
        ))}
      </div>

      <div className="panel table-wrap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">My Cancellations</p>
            <h3>Cancellation Table</h3>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Booking ID</th>
              <th>Route</th>
              <th>Cancelled On</th>
              <th>Refund</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {cancellations.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.bookingId}</td>
                <td>{record.route || record.travelName}</td>
                <td>{record.cancellationDate}</td>
                <td>{record.refundAmountLabel}</td>
                <td>{record.refundStatus}</td>
                <td>{record.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default BookingHistoryPage;
