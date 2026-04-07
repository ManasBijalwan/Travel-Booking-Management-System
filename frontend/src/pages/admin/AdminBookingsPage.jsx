import { useEffect, useMemo, useState } from "react";
import { deleteAdminResource, getAdminResource } from "../../services/adminService";

function AdminBookingsPage() {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const loadRecords = async () => {
    const result = await getAdminResource("bookings");
    setRecords(result);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleDelete = async (recordId) => {
    await deleteAdminResource("bookings", recordId);
    await loadRecords();
  };

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [
        record.id,
        record.travel?.name,
        record.status,
        record.paymentStatus,
        record.selectedSeats?.join(", "),
        record.pnr,
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
          <h1>Bookings</h1>
          <p>View reservations, passenger counts, payment state, and trip assignments.</p>
        </div>
      </div>

      <div className="panel table-wrap">
        <input
          type="text"
          placeholder="Search bookings"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>PNR</th>
              <th>Trip</th>
              <th>Passengers</th>
              <th>Seats</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.pnr}</td>
                <td>{record.travel?.name || record.travelId}</td>
                <td>{record.passengers?.length}</td>
                <td>{record.selectedSeats?.join(", ")}</td>
                <td>{record.status}</td>
                <td>{record.paymentStatus}</td>
                <td>
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
    </section>
  );
}

export default AdminBookingsPage;
