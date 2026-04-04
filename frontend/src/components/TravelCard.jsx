import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function TravelCard({ travel }) {
  const { user } = useAuth();
  const location = useLocation();

  const bookingTarget = user?.role === "user"
    ? `/booking/${travel.id}`
    : `/login/user?redirect=${encodeURIComponent(`/booking/${travel.id}`)}`;

  return (
    <article className="travel-card">
      <div className="travel-card__header">
        <div>
          <p className="eyebrow">{travel.type}</p>
          <h3>{travel.name}</h3>
        </div>
        <span className="price-tag">{travel.price}</span>
      </div>

      <div className="travel-route">
        <div>
          <strong>{travel.origin}</strong>
          <span>{travel.departureTime}</span>
        </div>
        <div className="travel-route__line">{travel.duration}</div>
        <div>
          <strong>{travel.destination}</strong>
          <span>{travel.arrivalTime}</span>
        </div>
      </div>

      <div className="meta-grid">
        <span>{travel.departureDate}</span>
        <span>{travel.seatsAvailable} seats left</span>
        <span>{travel.vehicleCode}</span>
      </div>

      <div className="amenity-list">
        {travel.amenities.map((amenity) => (
          <span key={amenity}>{amenity}</span>
        ))}
      </div>

      {user?.role === "admin" ? (
        <Link to="/admin/dashboard" className="ghost-button">
          View Admin Dashboard
        </Link>
      ) : (
        <Link to={bookingTarget} state={{ from: location, travel }} className="primary-button">
          {user?.role === "user" ? "Book Now" : "Login To Book"}
        </Link>
      )}
    </article>
  );
}

export default TravelCard;
