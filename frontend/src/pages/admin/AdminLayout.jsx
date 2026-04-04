import { NavLink, Outlet } from "react-router-dom";

function AdminLayout() {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <p className="eyebrow">Operations</p>
        <h2>Admin Panel</h2>
        <nav>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/operators">Operators</NavLink>
          <NavLink to="/admin/locations">Locations</NavLink>
          <NavLink to="/admin/vehicles">Vehicles</NavLink>
          <NavLink to="/admin/routes">Routes</NavLink>
          <NavLink to="/admin/bookings">Bookings</NavLink>
          <NavLink to="/admin/payments">Payments</NavLink>
          <NavLink to="/admin/cancellations">Cancellations</NavLink>
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
