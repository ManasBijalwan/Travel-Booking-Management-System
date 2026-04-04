import { useEffect, useMemo, useState } from "react";
import { getAdminResource } from "../../services/travelService";

function AdminPaymentsPage() {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadRecords = async () => {
      const result = await getAdminResource("payments");
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
      [record.id, record.bookingId, record.method, record.status, record.amount, record.date]
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
          <h1>Payments</h1>
          <p>Monitor payment method, amount collected, and settlement status.</p>
        </div>
      </div>
      <div className="panel table-wrap">
        <input
          type="text"
          placeholder="Search payments"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Booking ID</th>
              <th>Method</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.bookingId}</td>
                <td>{record.method}</td>
                <td>{record.status}</td>
                <td>{record.amountLabel}</td>
                <td>{record.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AdminPaymentsPage;
