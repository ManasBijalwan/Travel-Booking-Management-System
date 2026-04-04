import { useEffect, useMemo, useState } from "react";
import { getAdminResource } from "../../services/travelService";

function AdminCancellationsPage() {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadRecords = async () => {
      const result = await getAdminResource("cancellations");
      setRecords(result);
    };

    loadRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return records;
    }

    return records.filter((record) =>
      [record.id, record.bookingId, record.route, record.reason, record.refundStatus, record.refundAmount]
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
          <h1>Cancellations</h1>
          <p>Track cancelled bookings, refund amount, and reimbursement status.</p>
        </div>
      </div>
      <div className="panel table-wrap">
        <input
          type="text"
          placeholder="Search cancellations"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Booking ID</th>
              <th>Route</th>
              <th>Cancelled On</th>
              <th>Refund</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.bookingId}</td>
                <td>{record.route || record.travelName}</td>
                <td>{record.cancellationDate}</td>
                <td>{record.refundAmountLabel}</td>
                <td>{record.refundStatus}</td>
                <td>{record.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AdminCancellationsPage;
