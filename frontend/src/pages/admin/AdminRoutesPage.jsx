import { useEffect, useMemo, useState } from "react";
import {
  deleteAdminResource,
  getAdminResource,
  getRouteFormOptions,
  upsertAdminResource
} from "../../services/travelService";
import { validateRouteForm } from "../../utils/formValidation";

const defaultStop = {
  location_id:       "",
  arrivalDateTime:   "",
  departureDateTime: ""
};

const defaultForm = {
  mode_id:            "",
  origin:             "",
  destination:        "",
  departureDateTime:  "",
  arrivalDateTime:    "",
  operator_id:        "",
  vehicle_id:         "",
  status:             "active",
  intermediateStops:  []
};

// Colour-coded status badge
function StatusBadge({ status }) {
  const isActive = status?.toLowerCase() === "active";
  return (
    <span
      style={{
        display:      "inline-block",
        padding:      "0.2rem 0.7rem",
        borderRadius: "999px",
        fontSize:     "0.78rem",
        fontWeight:   600,
        background:   isActive ? "rgba(15,118,110,0.15)" : "rgba(180,35,24,0.12)",
        color:        isActive ? "var(--primary-dark)"   : "var(--danger)",
        whiteSpace:   "nowrap",
      }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function AdminRoutesPage() {
  const [records, setRecords]               = useState([]);
  const [form, setForm]                     = useState(defaultForm);
  const [editingId, setEditingId]           = useState(null);
  const [searchTerm, setSearchTerm]         = useState("");
  const [error, setError]                   = useState("");
  const [modeOptions, setModeOptions]       = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);

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
  };

  useEffect(() => { loadData(); }, []);

  // Filter operators by selected mode
  const filteredOperatorOptions = useMemo(() => {
    if (!form.mode_id) return operatorOptions;
    return operatorOptions.filter(o => String(o.mode_id) === String(form.mode_id));
  }, [form.mode_id, operatorOptions]);

  // Filter vehicles by mode + operator + not assigned elsewhere (except current edit)
  const filteredVehicleOptions = useMemo(() => {
    return vehicleOptions.filter(o => {
      const modeOk     = !form.mode_id     || String(o.mode_id)     === String(form.mode_id);
      const operatorOk = !form.operator_id || String(o.operator_id) === String(form.operator_id);
      const assignOk   = !o.assigned_route_id || String(o.assigned_route_id) === String(editingId || "");
      return modeOk && operatorOk && assignOk;
    });
  }, [editingId, form.mode_id, form.operator_id, vehicleOptions]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(current => {
      const next = { ...current, [name]: value };
      // Cascade resets
      if (name === "mode_id") {
        if (!operatorOptions.some(o => String(o.value) === String(current.operator_id) && String(o.mode_id) === String(value)))
          next.operator_id = "";
        if (!vehicleOptions.some(o => String(o.value) === String(current.vehicle_id) && String(o.mode_id) === String(value)))
          next.vehicle_id = "";
      }
      if (name === "operator_id") {
        if (!vehicleOptions.some(o => String(o.value) === String(current.vehicle_id) && String(o.operator_id) === String(value)))
          next.vehicle_id = "";
      }
      return next;
    });
    setError("");
  };

  const handleStopChange = (index, field, value) => {
    setForm(current => ({
      ...current,
      intermediateStops: current.intermediateStops.map((stop, i) =>
        i === index ? { ...stop, [field]: value } : stop
      )
    }));
  };

  const addStop    = () => setForm(c => ({ ...c, intermediateStops: [...c.intermediateStops, { ...defaultStop }] }));
  const removeStop = (index) => setForm(c => ({ ...c, intermediateStops: c.intermediateStops.filter((_, i) => i !== index) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const validationError = validateRouteForm(form);
    if (validationError) { setError(validationError); return; }
    try {
      await upsertAdminResource("routes", editingId ? { ...form, id: editingId } : form);
      setForm(defaultForm);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to save this route.");
    }
  };

  const handleDelete = async (id) => {
    await deleteAdminResource("routes", id);
    await loadData();
  };

  const handleEdit = (record) => {
    setForm({
      mode_id:           record.mode_id           || "",
      origin:            record.origin             || "",
      destination:       record.destination        || "",
      departureDateTime: record.departureDateTime  || "",
      arrivalDateTime:   record.arrivalDateTime    || "",
      operator_id:       record.operator_id        || "",
      vehicle_id:        record.vehicle_id         || "",
      status:            record.status             || "active",
      intermediateStops: record.intermediateStops  || []
    });
    setEditingId(record.id);
    setError("");
  };

  const handleCancelEdit = () => { setEditingId(null); setForm(defaultForm); setError(""); };

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      [r.mode_type, r.origin_name, r.destination_name, r.operator_name, r.status]
        .join(" ").toLowerCase().includes(q)
    );
  }, [records, searchTerm]);

  return (
    <section className="page-shell route-admin-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Routes</h1>
          <p>Configure route details, operator, vehicle, and arrival/departure times for each point.</p>
        </div>
      </div>

      <div className="admin-grid">
        {/* ── Form ── */}
        <form className="panel admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Update Route" : "Add Route"}</h3>
          {error && <p className="error-text">{error}</p>}
          <div className="form-grid">
            <select name="mode_id" value={form.mode_id} onChange={handleChange}>
              <option value="">Mode Type</option>
              {modeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select name="origin" value={form.origin} onChange={handleChange}>
              <option value="">Origin</option>
              {locationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select name="destination" value={form.destination} onChange={handleChange}>
              <option value="">Destination</option>
              {locationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Departure</span>
              <input type="datetime-local" name="departureDateTime" value={form.departureDateTime} onChange={handleChange} />
            </label>
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Arrival</span>
              <input type="datetime-local" name="arrivalDateTime" value={form.arrivalDateTime} onChange={handleChange} />
            </label>
            <select name="operator_id" value={form.operator_id} onChange={handleChange}>
              <option value="">Operator</option>
              {filteredOperatorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select name="vehicle_id" value={form.vehicle_id} onChange={handleChange}>
              <option value="">Available Vehicle</option>
              {filteredVehicleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="route-admin-actions">
            <button type="submit" className="primary-button">
              {editingId ? "Update Route" : "Save Route"}
            </button>
            {editingId && (
              <button type="button" className="ghost-button" onClick={handleCancelEdit}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {/* ── Table ── */}
        <div className="panel">
          <h3>Current Routes</h3>
          <input
            type="text"
            placeholder="Search routes"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Mode</th>
                  <th>Route</th>
                  <th>Operator</th>
                  <th>Vehicle</th>
                  <th>Schedule</th>
                  <th>Stops</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(record => (
                  <tr key={record.id}>
                    {/* Colour-coded status badge */}
                    <td><StatusBadge status={record.status} /></td>
                    <td>{record.mode_type}</td>
                    <td>
                      <strong>{record.origin_name}</strong>
                      <span style={{ color: "var(--muted)" }}> → </span>
                      <strong>{record.destination_name}</strong>
                    </td>
                    <td>{record.operator_name || record.operator_id}</td>
                    <td>{record.vehicle_name  || record.vehicle_id  || "—"}</td>
                    <td style={{ fontSize: "0.85rem" }}>
                      {record.departureDateTime
                        ? new Date(record.departureDateTime).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                      {" → "}
                      {record.arrivalDateTime
                        ? new Date(record.arrivalDateTime).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                    </td>
                    <td>
                      {record.intermediateStops?.length
                        ? record.intermediateStops
                            .map(s => s.location_name)
                            .join(", ")
                        : "Direct"}
                    </td>
                    <td>
                      <button type="button" className="ghost-button" onClick={() => handleEdit(record)}>
                        Edit
                      </button>
                      <button type="button" className="ghost-button danger" onClick={() => handleDelete(record.id)}>
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

      {/* ── Intermediate Stops panel ── */}
      <div className="panel route-stops-panel route-stops-panel--full">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Intermediate Stops</p>
            <h3>Stops</h3>
            <p>Saved with the route form above.</p>
          </div>
          <button type="button" className="primary-button stop-add-button" onClick={addStop}>
            +
          </button>
        </div>

        <div className="route-stops-list">
          {form.intermediateStops.length ? (
            form.intermediateStops.map((stop, index) => (
              <div key={`${stop.location_id}-${index}`} className="route-stop-row">
                <div className="route-stop-row__header">
                  <span className="user-pill">Stop {index + 1}</span>
                  <button type="button" className="ghost-button danger route-stop-remove" onClick={() => removeStop(index)}>
                    Remove
                  </button>
                </div>
                <div className="route-stop-row__fields route-stop-row__fields--datetime">
                  <label className="route-stop-field">
                    <span>Stop Location</span>
                    <select value={stop.location_id} onChange={e => handleStopChange(index, "location_id", e.target.value)}>
                      <option value="">Select Location</option>
                      {locationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="route-stop-field">
                    <span>Arrival Date and Time</span>
                    <input type="datetime-local" value={stop.arrivalDateTime} onChange={e => handleStopChange(index, "arrivalDateTime", e.target.value)} />
                  </label>
                  <label className="route-stop-field">
                    <span>Departure Date and Time</span>
                    <input type="datetime-local" value={stop.departureDateTime} onChange={e => handleStopChange(index, "departureDateTime", e.target.value)} />
                  </label>
                </div>
              </div>
            ))
          ) : (
            <p className="helper-text">Add a stop to capture its location and timing details.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminRoutesPage;
