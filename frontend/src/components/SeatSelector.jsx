function SeatSelector({ seatMap, selectedSeats, onChange, maxSeats }) {
  const toggleSeat = (seat) => {
    const exists = selectedSeats.includes(seat);

    if (!exists && selectedSeats.length >= maxSeats) {
      return;
    }

    const nextSeats = exists
      ? selectedSeats.filter((entry) => entry !== seat)
      : [...selectedSeats, seat];
    onChange(nextSeats);
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h3>Select Seats</h3>
          <p className="helper-text">Select up to {maxSeats} seat{maxSeats === 1 ? "" : "s"}.</p>
        </div>
        <span className="user-pill">{selectedSeats.length} selected</span>
      </div>

      <div className="seat-map">
        {seatMap.map((row, rowIndex) => (
          <div key={rowIndex} className="seat-row">
            {row.map((seat) => (
              <button
                key={seat}
                type="button"
                className={`seat ${selectedSeats.includes(seat) ? "active" : ""}`}
                onClick={() => toggleSeat(seat)}
              >
                {seat}
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default SeatSelector;
