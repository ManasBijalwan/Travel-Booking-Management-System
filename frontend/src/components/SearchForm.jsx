import { useState } from "react";

const defaultState = {
  type: "",
  origin: "",
  destination: "",
  departureDate: "",
};

// modes: array of { value, label } from backend, e.g. [{ value: "Train", label: "Train" }]
// Falls back to empty list — SearchPage fetches and passes them.
function SearchForm({ onSearch, initialValues = defaultState, compact = false, modes = [] }) {
  const [form, setForm] = useState({ ...defaultState, ...initialValues });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch(form);
  };

  return (
    <form
      className={`search-form ${compact ? "compact" : ""}`}
      onSubmit={handleSubmit}
    >
      <select name="type" value={form.type} onChange={handleChange}>
        <option value="">All Modes</option>
        {modes.map((mode) => (
          <option key={mode.value} value={mode.value}>
            {mode.label}
          </option>
        ))}
      </select>

      <input
        name="origin"
        value={form.origin}
        onChange={handleChange}
        placeholder="From"
      />

      <input
        name="destination"
        value={form.destination}
        onChange={handleChange}
        placeholder="To"
      />

      <input
        type="date"
        name="departureDate"
        value={form.departureDate}
        onChange={handleChange}
      />

      <button type="submit" className="primary-button search-form__button">
        Search
      </button>
    </form>
  );
}

export default SearchForm;
