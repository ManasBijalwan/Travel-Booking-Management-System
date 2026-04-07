import { useEffect, useState } from "react";
import { getAdminOverview } from "../../services/adminService";

function AdminDashboardPage() {
  const [overview, setOverview] = useState({ metrics: [], bookings: [], payments: [] });

  useEffect(() => {
    getAdminOverview().then(setOverview);
  }, []);

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Travel operations snapshot</h1>
        </div>
      </div>

      <div className="stats-grid">
        {overview.metrics.map((metric) => (
          <div key={metric.label} className="panel stat-card">
            <p>{metric.label}</p>
            <h3>{metric.value}</h3>
          </div>
        ))}
      </div>

      <div className="admin-grid">
        <div className="panel">
          <h3>Recent Bookings</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {overview.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.id}</td>
                    <td>
                      {booking.travel?.origin} to {booking.travel?.destination}
                    </td>
                    <td>{booking.status}</td>
                    <td>{booking.totalAmountLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h3>Payments</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {overview.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.id}</td>
                    <td>{payment.method}</td>
                    <td>{payment.status}</td>
                    <td>{payment.amountLabel}</td>
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

export default AdminDashboardPage;
