// unavailableSeats: array of seat labels already booked on this schedule (from API)
function SeatSelector({ seatMap, selectedSeats, onChange, maxSeats, unavailableSeats = [] }) {
  const isUnavailable = (seat) => unavailableSeats.includes(seat);

  const toggleSeat = (seat) => {
    if (isUnavailable(seat)) return; // can't select a booked seat
    const exists = selectedSeats.includes(seat);
    if (!exists && selectedSeats.length >= maxSeats) return;
    const nextSeats = exists
      ? selectedSeats.filter((s) => s !== seat)
      : [...selectedSeats, seat];
    onChange(nextSeats);
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h3>Select Seats</h3>
          <p className="helper-text">
            Select up to {maxSeats} seat{maxSeats === 1 ? "" : "s"}.
            {unavailableSeats.length > 0 && (
              <span> Grey seats are already booked.</span>
            )}
          </p>
        </div>
        <span className="user-pill">{selectedSeats.length} selected</span>
      </div>

      <div className="seat-map">
        {seatMap.map((row, rowIndex) => (
          <div key={rowIndex} className="seat-row">
            {row.map((seat) => {
              const booked   = isUnavailable(seat);
              const selected = selectedSeats.includes(seat);
              return (
                <button
                  key={seat}
                  type="button"
                  className={`seat ${selected ? "active" : ""} ${booked ? "booked" : ""}`}
                  onClick={() => toggleSeat(seat)}
                  disabled={booked}
                  title={booked ? "Already booked" : seat}
                >
                  {seat}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.85rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span className="seat" style={{ width: 28, height: 20, display: "inline-block", borderRadius: 4 }} />
          Available
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span className="seat active" style={{ width: 28, height: 20, display: "inline-block", borderRadius: 4 }} />
          Selected
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span className="seat booked" style={{ width: 28, height: 20, display: "inline-block", borderRadius: 4 }} />
          Booked
        </span>
      </div>
    </section>
  );
}

export default SeatSelector;
