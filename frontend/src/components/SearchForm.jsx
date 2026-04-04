import { useState } from "react";

const defaultState = {
  type: "",
  origin: "",
  destination: "",
  departureDate: ""
};

function SearchForm({ onSearch, initialValues = defaultState, compact = false }) {
  const [form, setForm] = useState(initialValues);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch(form);
  };

  return (
    <form className={`search-form ${compact ? "compact" : ""}`} onSubmit={handleSubmit}>
      <select name="type" value={form.type} onChange={handleChange}>
        <option value="">All Modes</option>
        <option value="train">Train</option>
        <option value="bus">Bus</option>
        <option value="flight">Flight</option>
      </select>
      <input name="origin" value={form.origin} onChange={handleChange} placeholder="From" />
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
        Book
      </button>
    </form>
  );
}

export default SearchForm;
