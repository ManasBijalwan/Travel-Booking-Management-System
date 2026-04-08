import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function TravelCard({ travel }) {
  const { user } = useAuth();
  const location = useLocation();

  const bookingTarget = user?.role === "user"
    ? `/booking/${travel.id}`
    : `/login/user?redirect=${encodeURIComponent(`/booking/${travel.id}`)}`;

  const priceLabel = `₹${Number(travel.price || 0).toLocaleString("en-IN")}`;

  return (
    <article className="travel-card">
      <div className="travel-card__header">
        <div>
          <p className="eyebrow">{travel.type}</p>
          <h3>{travel.name}</h3>
          <p className="helper-text" style={{ margin: 0 }}>{travel.operatorName}</p>
        </div>
        <span className="price-tag">{priceLabel} / seat</span>
      </div>

      <div className="travel-route">
        <div>
          <strong>{travel.origin}</strong>
          <br />
          <span>{travel.departureTime}</span>
        </div>
        <div className="travel-route__line">
          {travel.type}
          {travel.intermediateStops?.length > 0 && (
            <span style={{ display: "block", fontSize: "0.75rem" }}>
              {travel.intermediateStops.length} stop{travel.intermediateStops.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div>
          <strong>{travel.destination}</strong>
          <br />
          <span>{travel.arrivalTime}</span>
        </div>
      </div>

      <div className="meta-grid">
        <span>{travel.departureDate}</span>
        <span>{travel.seatsAvailable} seats left</span>
        <span>{travel.vehicleCode}</span>
      </div>

      {user?.role === "admin" ? (
        <Link to="/admin/dashboard" className="ghost-button">
          View Admin Dashboard
        </Link>
      ) : (
        <Link
          to={bookingTarget}
          state={{ from: location, travel }}
          className="primary-button"
        >
          {user?.role === "user" ? "Book Now" : "Login to Book"}
        </Link>
      )}
    </article>
  );
}

export default TravelCard;
