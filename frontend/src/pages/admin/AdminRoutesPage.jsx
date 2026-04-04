import { useEffect, useMemo, useState } from "react";
import {
  deleteAdminResource,
  getAdminResource,
  getRouteFormOptions,
  upsertAdminResource
} from "../../services/travelService";

const defaultStop = {
  location_id: "",
  arrival_time: "",
  departure_time: ""
};

const defaultForm = {
  mode_id: "",
  origin: "",
  destination: "",
  departureTime: "",
  arrivalTime: "",
  operator_id: "",
  vehicle_id: "",
  status: "active",
  serviceDays: [],
  bookingStartDate: "",
  bookingEndDate: "",
  intermediateStops: []
};

function AdminRoutesPage() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [modeOptions, setModeOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [weekDays, setWeekDays] = useState([]);

  const loadData = async () => {
    const [routeRecords, optionData] = await Promise.all([
      getAdminResource("routes"),
      getRouteFormOptions()
    ]);
    setRecords(routeRecords);
    setModeOptions(optionData.modes);
    setLocationOptions(optionData.locations);
    setOperatorOptions(optionData.operators);
    setVehicleOptions(optionData.vehicles);
    setWeekDays(optionData.weekDays);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleDay = (day) => {
    setForm((current) => ({
      ...current,
      serviceDays: current.serviceDays.includes(day)
        ? current.serviceDays.filter((item) => item !== day)
        : [...current.serviceDays, day]
    }));
  };

  const handleStopChange = (index, field, value) => {
    setForm((current) => ({
      ...current,
      intermediateStops: current.intermediateStops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, [field]: value } : stop
      )
    }));
  };

  const addStop = () => {
    setForm((current) => ({
      ...current,
      intermediateStops: [...current.intermediateStops, { ...defaultStop }]
    }));
  };

  const removeStop = (index) => {
    setForm((current) => ({
      ...current,
      intermediateStops: current.intermediateStops.filter((_, stopIndex) => stopIndex !== index)
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.bookingStartDate || !form.bookingEndDate) {
      setError("Select the booking visibility date range.");
      return;
    }

    const startDate = new Date(form.bookingStartDate);
    const endDate = new Date(form.bookingEndDate);
    const diffDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

    if (Number.isNaN(diffDays) || diffDays < 0) {
      setError("Booking end date must be on or after the start date.");
      return;
    }

    if (diffDays > 9) {
      setError("Booking date range cannot be more than 10 days.");
      return;
    }

    if (!form.serviceDays.length) {
      setError("Select at least one active day for the route.");
      return;
    }

    await upsertAdminResource("routes", editingId ? { ...form, id: editingId } : form);
    setForm(defaultForm);
    setEditingId(null);
    await loadData();
  };

  const handleDelete = async (recordId) => {
    await deleteAdminResource("routes", recordId);
    await loadData();
  };

  const handleEdit = (record) => {
    setForm({
      mode_id: record.mode_id || "",
      origin: record.origin || "",
      destination: record.destination || "",
      departureTime: record.departureTime || "",
      arrivalTime: record.arrivalTime || "",
      operator_id: record.operator_id || "",
      vehicle_id: record.vehicle_id || "",
      status: record.status || "active",
      serviceDays: record.serviceDays || [],
      bookingStartDate: record.bookingStartDate || "",
      bookingEndDate: record.bookingEndDate || "",
      intermediateStops: record.intermediateStops || []
    });
    setEditingId(record.id);
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(defaultForm);
    setError("");
  };

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return records;
    }

    return records.filter((record) =>
      [
        record.mode_type,
        record.origin_name,
        record.destination_name,
        record.operator_name,
        record.vehicle_name,
        record.departureTime,
        record.arrivalTime,
        record.serviceDays.join(" "),
        record.bookingStartDate,
        record.bookingEndDate,
        record.intermediateStops
          .map((stop) => `${stop.location_name} ${stop.arrival_time} ${stop.departure_time}`)
          .join(" ")
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [records, searchTerm]);

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Routes</h1>
          <p>Configure route details, active days, booking window, linked operator and vehicle, and stop timings.</p>
        </div>
      </div>

      <div className="admin-grid">
        <form className="panel admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Update Route" : "Add Route"}</h3>
          {error && <p className="error-text">{error}</p>}
          <div className="form-grid">
            <select name="mode_id" value={form.mode_id} onChange={handleChange}>
              <option value="">Mode Type</option>
              {modeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select name="origin" value={form.origin} onChange={handleChange}>
              <option value="">Origin</option>
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select name="destination" value={form.destination} onChange={handleChange}>
              <option value="">Destination</option>
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input type="time" name="departureTime" value={form.departureTime} onChange={handleChange} />
            <input type="time" name="arrivalTime" value={form.arrivalTime} onChange={handleChange} />
            <select name="operator_id" value={form.operator_id} onChange={handleChange}>
              <option value="">Operator ID</option>
              {operatorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select name="vehicle_id" value={form.vehicle_id} onChange={handleChange}>
              <option value="">Vehicle ID</option>
              {vehicleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <input type="date" name="bookingStartDate" value={form.bookingStartDate} onChange={handleChange} />
            <input type="date" name="bookingEndDate" value={form.bookingEndDate} onChange={handleChange} />
          </div>

          <div className="panel">
            <p className="eyebrow">Route Active Days</p>
            <div className="amenity-list">
              {weekDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={form.serviceDays.includes(day) ? "primary-button" : "ghost-button"}
                  onClick={() => toggleDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="panel route-stops-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Intermediate Stops</p>
                <h3>Stops</h3>
              </div>
              <button type="button" className="primary-button stop-add-button" onClick={addStop}>
                +
              </button>
            </div>

            <div className="route-stops-list">
              {form.intermediateStops.map((stop, index) => (
                <div key={`${stop.location_id}-${index}`} className="route-stop-row">
                  <select
                    value={stop.location_id}
                    onChange={(event) => handleStopChange(index, "location_id", event.target.value)}
                  >
                    <option value="">Stop Location</option>
                    {locationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={stop.arrival_time}
                    onChange={(event) => handleStopChange(index, "arrival_time", event.target.value)}
                  />
                  <input
                    type="time"
                    value={stop.departure_time}
                    onChange={(event) => handleStopChange(index, "departure_time", event.target.value)}
                  />
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() => removeStop(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="primary-button">
            {editingId ? "Update Route" : "Save Route"}
          </button>
          {editingId && (
            <button type="button" className="ghost-button" onClick={handleCancelEdit}>
              Cancel Edit
            </button>
          )}
        </form>

        <div className="panel">
          <h3>Current Routes</h3>
          <input
            type="text"
            placeholder="Search routes"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Path</th>
                  <th>Operator</th>
                  <th>Vehicle</th>
                  <th>Times</th>
                  <th>Active Days</th>
                  <th>Booking Window</th>
                  <th>Stops</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.mode_type}</td>
                    <td>{record.origin_name} to {record.destination_name}</td>
                    <td>{record.operator_name || record.operator_id}</td>
                    <td>{record.vehicle_name || record.vehicle_id}</td>
                    <td>{record.departureTime} - {record.arrivalTime}</td>
                    <td>{record.serviceDays.join(", ")}</td>
                    <td>{record.bookingStartDate} to {record.bookingEndDate}</td>
                    <td>
                      {record.intermediateStops.length
                        ? record.intermediateStops
                            .map((stop) => `${stop.location_name} (${stop.arrival_time}-${stop.departure_time})`)
                            .join(", ")
                        : "Direct"}
                    </td>
                    <td>
                      <button type="button" className="ghost-button" onClick={() => handleEdit(record)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-button danger"
                        onClick={() => handleDelete(record.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AdminRoutesPage;
