import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PassengerForm from "../components/PassengerForm";
import PaymentForm from "../components/PaymentForm";
import SeatSelector from "../components/SeatSelector";
import { useAuth } from "../context/AuthContext";
import { createBooking, getTravelById } from "../services/travelService";

function BookingFlowPage() {
  const { travelId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [travel, setTravel] = useState(location.state?.travel || null);
  const [passengers, setPassengers] = useState([
    { passenger_name: "", age: "", gender: "Male", id_proof_number: "", isSaved: false },
  ]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [payment, setPayment] = useState({
    method: "Card",
    cardName: "",
    cardNumber: "",
    expiry: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Always fetch fresh from API to get live seat availability + unavailableSeats
  useEffect(() => {
    getTravelById(travelId).then(setTravel).catch(() => {
      // Fallback to location state if API fails
      if (location.state?.travel) setTravel(location.state.travel);
    });
  }, [travelId]);

  const maxPassengers = Number(travel?.seatsAvailable || 0);
  const unavailableSeats = travel?.unavailableSeats || [];

  useEffect(() => {
    if (!maxPassengers) return;
    setPassengers((current) => current.slice(0, maxPassengers));
    // Drop any selected seats that are now unavailable
    setSelectedSeats((current) =>
      current.filter((s) => !unavailableSeats.includes(s)).slice(0, maxPassengers)
    );
  }, [maxPassengers]);

  const savedPassengers = useMemo(
    () => passengers.filter((p) => p.isSaved),
    [passengers]
  );

  const totalAmount = useMemo(
    () => (travel ? selectedSeats.length * travel.price : 0),
    [travel, selectedSeats.length]
  );

  const handleBooking = async () => {
    if (!travel) return;

    if (maxPassengers <= 0) {
      setError("No seats are available for this trip.");
      return;
    }
    if (!savedPassengers.length) {
      setError("Save at least one passenger before confirming.");
      return;
    }
    if (selectedSeats.length !== savedPassengers.length) {
      setError("Select exactly one seat per saved passenger.");
      return;
    }
    // Guard against race condition — seat snatched between page load and submit
    const claimedByOther = selectedSeats.filter((s) => unavailableSeats.includes(s));
    if (claimedByOther.length > 0) {
      setError(`Seat(s) ${claimedByOther.join(", ")} are no longer available. Please re-select.`);
      return;
    }
    if (!payment.cardNumber) {
      setError("Complete payment details before confirming.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await createBooking({
        userId:               user.id,
        travelId:             travel.id,
        boardingLocationId:   travel.originLocationId,
        droppingLocationId:   travel.destinationLocationId,
        passengers:           savedPassengers,
        selectedSeats,
        totalAmount,
        payment,
      });
      navigate("/history");
    } catch (err) {
      setError(err.response?.data?.error || "Booking failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (!travel) {
    return <section className="page-shell">Loading booking details...</section>;
  }

  return (
    <section className="page-shell booking-page">
      {/* Trip summary */}
      <div className="booking-summary panel">
        <p className="eyebrow">{travel.type}</p>
        <h1>{travel.name}</h1>
        <p>
          {travel.origin} → {travel.destination} &nbsp;|&nbsp;
          {travel.departureDate} at {travel.departureTime}
        </p>
        <div className="meta-grid">
          <span>{travel.duration}</span>
          <span>{travel.seatsAvailable} seats remaining</span>
          <span>₹{Number(travel.price).toLocaleString("en-IN")} per seat</span>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <PassengerForm
        passengers={passengers}
        onChange={setPassengers}
        maxPassengers={maxPassengers}
      />

      <SeatSelector
        seatMap={travel.seatMap}
        selectedSeats={selectedSeats}
        onChange={setSelectedSeats}
        maxSeats={savedPassengers.length || maxPassengers}
        unavailableSeats={unavailableSeats}
      />

      <PaymentForm
        payment={payment}
        onChange={setPayment}
        totalAmount={totalAmount}
        onSubmit={handleBooking}
        submitting={submitting}
      />
    </section>
  );
}

export default BookingFlowPage;
