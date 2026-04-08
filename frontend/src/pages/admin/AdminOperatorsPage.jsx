import { useEffect, useMemo, useState } from "react";
import { deleteAdminResource, getAdminResource, getVehicleFormOptions, upsertAdminResource } from "../../services/travelService";

// FIX: Old page was sending field 'mode_type' (a string like 'bus') which the
// backend doesn't map to the mode_id FK. Now we fetch modes from the API and
// send mode_id as a number, which the backend stores correctly.

function AdminOperatorsPage() {
  const [records, setRecords]     = useState([]);
  const [modeOptions, setModeOptions] = useState([]);
  const [form, setForm]           = useState({ operator_name: "", mode_id: "", contact_email: "", contact_phone: "" });
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError]         = useState("");

  const loadRecords = async () => {
    const result = await getAdminResource("operators");
    setRecords(result);
  };

  const loadModes = async () => {
    const opts = await getVehicleFormOptions();
    setModeOptions(opts.modes || []);
  };

  useEffect(() => {
    loadRecords();
    loadModes();
  }, []);

  const handleChange = (e) => {
    setForm(current => ({ ...current, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.operator_name?.trim()) return setError("Operator name is required.");
    if (!form.mode_id)               return setError("Select a travel mode.");
    try {
      await upsertAdminResource("operators",
        editingId ? { ...form, id: editingId } : form
      );
      setForm({ operator_name: "", mode_id: "", contact_email: "", contact_phone: "" });
      setEditingId(null);
      await loadRecords();
    } catch (err) {
      setError(err.message || "Unable to save operator.");
    }
  };

  const handleEdit = (record) => {
    setForm({
      operator_name: record.operator_name || "",
      mode_id:       record.mode_id       || "",
      contact_email: record.contact_email || "",
      contact_phone: record.contact_phone || "",
    });
    setEditingId(record.id);
    setError("");
  };

  const handleCancelEdit = () => {
    setForm({ operator_name: "", mode_id: "", contact_email: "", contact_phone: "" });
    setEditingId(null);
    setError("");
  };

  const handleDelete = async (id) => {
    await deleteAdminResource("operators", id);
    await loadRecords();
  };

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      [r.operator_name, r.mode_name, r.contact_email, r.contact_phone].join(" ").toLowerCase().includes(q)
    );
  }, [records, searchTerm]);

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Operators</h1>
          <p>Manage operators whose vehicles and routes are in the system.</p>
        </div>
      </div>

      <div className="admin-grid">
        <form className="panel admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Update Operator" : "Add Operator"}</h3>
          {error && <p className="error-text">{error}</p>}
          <div className="form-grid">
            <input
              name="operator_name"
              placeholder="Operator Name"
              value={form.operator_name}
              onChange={handleChange}
            />
            <select name="mode_id" value={form.mode_id} onChange={handleChange}>
              <option value="">Select Mode</option>
              {modeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              name="contact_email"
              type="email"
              placeholder="Contact Email"
              value={form.contact_email}
              onChange={handleChange}
            />
            <input
              name="contact_phone"
              placeholder="Contact Phone"
              value={form.contact_phone}
              onChange={handleChange}
            />
          </div>
          <button type="submit" className="primary-button">
            {editingId ? "Update Operator" : "Save Operator"}
          </button>
          {editingId && (
            <button type="button" className="ghost-button" onClick={handleCancelEdit}>
              Cancel Edit
            </button>
          )}
        </form>

        <div className="panel">
          <h3>Current Operators</h3>
          <input
            type="text"
            placeholder="Search operators"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mode</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(r => (
                  <tr key={r.id}>
                    <td>{r.operator_name}</td>
                    <td>{r.mode_name}</td>
                    <td>{r.contact_email || "—"}</td>
                    <td>{r.contact_phone || "—"}</td>
                    <td>
                      <button type="button" className="ghost-button" onClick={() => handleEdit(r)}>
                        Edit
                      </button>
                      <button type="button" className="ghost-button danger" onClick={() => handleDelete(r.id)}>
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

export default AdminOperatorsPage;
