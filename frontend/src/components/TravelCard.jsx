import { useNavigate } from "react-router-dom";

function TravelCard({ travel }) {
  const navigate = useNavigate();

  const handleBook = () => {
    navigate(`/booking/${travel.id}`, { state: { travel } });
  };

  return (
    <article className="travel-card panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{travel.type} · {travel.operatorName}</p>
          <h3>{travel.name}</h3>
        </div>
        <span className="price-tag">₹{Number(travel.price).toLocaleString("en-IN")}</span>
      </div>

      <div className="travel-route">
        <div>
          <p className="travel-time">{travel.departureTime}</p>
          <p className="travel-city">{travel.origin}</p>
        </div>
        <div className="travel-route__mid">
          <span className="helper-text">{travel.duration}</span>
          <div className="travel-route__line" />
        </div>
        <div>
          <p className="travel-time">{travel.arrivalTime}</p>
          <p className="travel-city">{travel.destination}</p>
        </div>
      </div>

      {travel.amenities?.length > 0 && (
        <div className="amenity-list">
          {travel.amenities.map((stop) => (
            <span key={stop} className="amenity-tag">{stop}</span>
          ))}
        </div>
      )}

      <div className="card-footer">
        <span className="helper-text">
          {travel.seatsAvailable} seat{travel.seatsAvailable === 1 ? "" : "s"} left
          · {travel.departureDate}
        </span>
        <button
          type="button"
          className="primary-button"
          onClick={handleBook}
          disabled={!travel.seatsAvailable}
        >
          {travel.seatsAvailable ? "Book Now" : "Sold Out"}
        </button>
      </div>
    </article>
  );
}

export default TravelCard;
