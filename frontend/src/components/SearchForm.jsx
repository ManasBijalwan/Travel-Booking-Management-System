import { useEffect, useState } from "react";
import apiClient from "../api/client";

const defaultState = {
  type:          "",
  origin:        "",
  destination:   "",
  departureDate: "",
};

function SearchForm({ onSearch, initialValues = defaultState, compact = false }) {
  const [form, setForm]             = useState({ ...defaultState, ...initialValues });
  const [error, setError]           = useState("");
  const [locations, setLocations]   = useState([]);
  const [loadingLoc, setLoadingLoc] = useState(false);

  // Fetch available locations whenever mode changes
  useEffect(() => {
    if (!form.type) {
      setLocations([]);
      return;
    }
    setLoadingLoc(true);
    apiClient
      .get("/travels/locations", { params: { mode: form.type } })
      .then(r => setLocations(r.data || []))
      .catch(() => setLocations([]))
      .finally(() => setLoadingLoc(false));
  }, [form.type]);

  const handleModeChange = (e) => {
    setForm(current => ({
      ...current,
      type:        e.target.value,
      origin:      "",   // reset when mode changes
      destination: "",
    }));
    setError("");
  };

  const handleChange = (e) => {
    setForm(current => ({ ...current, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.type)          return setError("Select a travel mode.");
    if (!form.origin)        return setError("Select a departure location.");
    if (!form.destination)   return setError("Select an arrival location.");
    if (form.origin === form.destination)
                             return setError("Origin and destination cannot be the same.");
    if (!form.departureDate) return setError("Select a travel date.");
    onSearch(form);
  };

  const originOptions = locations.filter(l => String(l.value) !== String(form.destination));
  const destOptions   = locations.filter(l => String(l.value) !== String(form.origin));

  // Human-readable hint for what location type is shown
  const locHint = form.type === "Train"  ? "Railway Stations"
                : form.type === "Flight" ? "Airports"
                : form.type === "Bus"    ? "Bus Stands"
                : "";

  return (
    <form className={`search-form ${compact ? "compact" : ""}`} onSubmit={handleSubmit}>
      {error && <p className="error-text">{error}</p>}

      <select name="type" value={form.type} onChange={handleModeChange}>
        <option value="" disabled>Select Mode</option>
        <option value="Train">Train</option>
        <option value="Bus">Bus</option>
        <option value="Flight">Flight</option>
      </select>

      <select
        name="origin"
        value={form.origin}
        onChange={handleChange}
        disabled={!form.type || loadingLoc}
      >
        <option value="" disabled>
          {!form.type        ? "Select mode first"
           : loadingLoc      ? "Loading…"
           : `From — ${locHint}`}
        </option>
        {originOptions.map(loc => (
          <option key={loc.value} value={loc.value}>{loc.label}</option>
        ))}
      </select>

      <select
        name="destination"
        value={form.destination}
        onChange={handleChange}
        disabled={!form.type || loadingLoc}
      >
        <option value="" disabled>
          {!form.type        ? "Select mode first"
           : loadingLoc      ? "Loading…"
           : `To — ${locHint}`}
        </option>
        {destOptions.map(loc => (
          <option key={loc.value} value={loc.value}>{loc.label}</option>
        ))}
      </select>

      <input
        type="date"
        name="departureDate"
        value={form.departureDate}
        onChange={handleChange}
        min={new Date().toISOString().slice(0, 10)}
      />

      <button type="submit" className="primary-button search-form__button">
        Search
      </button>
    </form>
  );
}

export default SearchForm;
