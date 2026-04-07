function PassengerForm({ passengers, onChange, maxPassengers }) {
  const updatePassenger = (index, field, value) => {
    const nextPassengers = passengers.map((passenger, i) =>
      i === index ? { ...passenger, [field]: value, isSaved: false } : passenger
    );
    onChange(nextPassengers);
  };

  const addPassenger = () => {
    if (passengers.length >= maxPassengers) return;
    onChange([
      ...passengers,
      { passenger_name: "", age: "", gender: "Male", id_proof_number: "", isSaved: false },
    ]);
  };

  const savePassenger = (index) => {
    const passenger = passengers[index];
    const hasDetails =
      passenger.passenger_name &&
      passenger.age &&
      passenger.gender &&
      passenger.id_proof_number;
    if (!hasDetails) return;
    const nextPassengers = passengers.map((item, i) =>
      i === index ? { ...item, isSaved: true } : item
    );
    onChange(nextPassengers);
  };

  const removePassenger = (index) => {
    onChange(passengers.filter((_, i) => i !== index));
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 1</p>
          <h3>Passenger Details</h3>
          <p className="helper-text">
            You can add up to {maxPassengers} passenger
            {maxPassengers === 1 ? "" : "s"} for this trip.
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={addPassenger}
          disabled={passengers.length >= maxPassengers}
        >
          Add Passenger
        </button>
      </div>

      <div className="passenger-list">
        {passengers.map((passenger, index) => (
          <div key={`${passenger.passenger_name}-${index}`} className="panel">
            <div className="section-heading">
              <h4>Passenger {index + 1}</h4>
              <span
                className={`status-badge ${passenger.isSaved ? "confirmed" : "pending"}`}
              >
                {passenger.isSaved ? "Saved" : "Pending"}
              </span>
            </div>

            <div className="form-grid">
              <input
                placeholder="Passenger name"
                value={passenger.passenger_name}
                onChange={(e) =>
                  updatePassenger(index, "passenger_name", e.target.value)
                }
              />
              <input
                type="number"
                placeholder="Age"
                value={passenger.age}
                onChange={(e) => updatePassenger(index, "age", e.target.value)}
              />
              <select
                value={passenger.gender}
                onChange={(e) =>
                  updatePassenger(index, "gender", e.target.value)
                }
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
              <input
                placeholder="ID proof number"
                value={passenger.id_proof_number}
                onChange={(e) =>
                  updatePassenger(index, "id_proof_number", e.target.value)
                }
              />
            </div>

            <div className="action-row">
              <button
                type="button"
                className="ghost-button"
                onClick={() => savePassenger(index)}
              >
                Save Passenger
              </button>
              <button
                type="button"
                className="ghost-button danger"
                onClick={() => removePassenger(index)}
              >
                Delete Passenger
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default PassengerForm;
