import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminBookingsPage from "./pages/admin/AdminBookingsPage";
import AdminCancellationsPage from "./pages/admin/AdminCancellationsPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminLocationsPage from "./pages/admin/AdminLocationsPage";
import AdminOperatorsPage from "./pages/admin/AdminOperatorsPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import AdminRoutesPage from "./pages/admin/AdminRoutesPage";
import AdminVehiclesPage from "./pages/admin/AdminVehiclesPage";
import BookingFlowPage from "./pages/BookingFlowPage";
import BookingHistoryPage from "./pages/BookingHistoryPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SearchPage from "./pages/SearchPage";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<Navigate to="/login/user" replace />} />
        <Route path="/login/user" element={<LoginPage role="user" />} />
        <Route path="/login/admin" element={<LoginPage role="admin" />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/search"
          element={
            <ProtectedRoute roles={["user"]}>
              <SearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking/:travelId"
          element={
            <ProtectedRoute roles={["user"]}>
              <BookingFlowPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute roles={["user"]}>
              <BookingHistoryPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="operators" element={<AdminOperatorsPage />} />
        <Route path="locations" element={<AdminLocationsPage />} />
        <Route path="vehicles" element={<AdminVehiclesPage />} />
        <Route path="routes" element={<AdminRoutesPage />} />
        <Route path="bookings" element={<AdminBookingsPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="cancellations" element={<AdminCancellationsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
