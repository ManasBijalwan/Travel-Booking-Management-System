import { useEffect, useMemo, useState } from "react";
import { getAdminResource, upsertAdminResource } from "../../services/travelService";

function AdminCancellationsPage() {
  const [records, setRecords]     = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError]         = useState("");
  const [savingId, setSavingId]   = useState(null);

  const loadRecords = async () => {
    const result = await getAdminResource("cancellations");
    setRecords(result);
  };

  useEffect(() => { loadRecords(); }, []);

  const handleFieldChange = (recordId, field, value) => {
    setRecords(current =>
      current.map(r => r.id === recordId ? { ...r, [field]: value } : r)
    );
  };

  const handleSave = async (record) => {
    try {
      setError("");
      setSavingId(record.id);
      await upsertAdminResource("cancellations", {
        id:           record.id,
        bookingId:    record.bookingId,
        refundAmount: record.refundAmount,
        refundStatus: record.refundStatus,
        reason:       record.reason,
      });
      await loadRecords();
    } catch (saveError) {
      setError(saveError.message || "Unable to update reimbursement details.");
    } finally {
      setSavingId(null);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      [r.id, r.bookingId, r.bookedByName, r.bookedByDisplayId,
       (r.passengerNames || []).join(", "), r.route, r.reason, r.refundStatus]
        .join(" ").toLowerCase().includes(q)
    );
  }, [records, searchTerm]);

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Cancellations</h1>
          <p>Track cancelled bookings and manage reimbursement status.</p>
        </div>
      </div>

      <div className="panel">
        {error && <p className="error-text">{error}</p>}
        <input
          type="text"
          placeholder="Search cancellations"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ marginBottom: "1rem" }}
        />

        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredRecords.length === 0 && (
            <p className="helper-text">No cancellations found.</p>
          )}
          {filteredRecords.map(record => (
            <div
              key={record.id}
              className="panel"
              style={{ padding: "1.25rem", gap: "0.75rem", display: "grid" }}
            >
              {/* Header row */}
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Cancellation #{record.id} — Booking #{record.bookingId}</p>
                  <h3 style={{ margin: 0 }}>{record.route || record.travelName}</h3>
                  <p className="helper-text" style={{ margin: 0 }}>
                    Booked by: <strong>{record.bookedByName || "—"}</strong>
                    {record.bookedByDisplayId ? ` (ID: ${record.bookedByDisplayId})` : ""}
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.3rem 0.8rem",
                    borderRadius: "999px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    background: record.refundStatus?.toLowerCase() === "reimbursed"
                      ? "rgba(15,118,110,0.15)" : "rgba(217,119,6,0.15)",
                    color: record.refundStatus?.toLowerCase() === "reimbursed"
                      ? "var(--primary-dark)" : "var(--secondary)",
                  }}
                >
                  {record.refundStatus}
                </span>
              </div>

              {/* Info grid */}
              <div className="meta-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <span><strong>Passengers:</strong> {(record.passengerNames || []).join(", ") || "—"}</span>
                <span><strong>Cancelled:</strong> {record.cancellationDate
                  ? new Date(record.cancellationDate).toLocaleDateString() : "—"}</span>
                <span><strong>Refund:</strong> {record.refundAmountLabel}</span>
              </div>

              {/* Editable fields */}
              <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <label style={{ display: "grid", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Reimbursement (₹)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={record.refundAmount}
                    onChange={e => handleFieldChange(record.id, "refundAmount", e.target.value)}
                  />
                </label>

                <label style={{ display: "grid", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Status</span>
                  <select
                    value={record.refundStatus}
                    onChange={e => handleFieldChange(record.id, "refundStatus", e.target.value)}
                  >
                    <option value="Initiated">Initiated</option>
                    <option value="Processing">Processing</option>
                    <option value="Reimbursed">Reimbursed</option>
                  </select>
                </label>

                <label style={{ display: "grid", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Reason</span>
                  <input
                    type="text"
                    value={record.reason || ""}
                    onChange={e => handleFieldChange(record.id, "reason", e.target.value)}
                  />
                </label>
              </div>

              <button
                type="button"
                className="primary-button"
                style={{ justifySelf: "start" }}
                disabled={savingId === record.id}
                onClick={() => handleSave(record)}
              >
                {savingId === record.id ? "Saving…" : "Save Changes"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default AdminCancellationsPage;
