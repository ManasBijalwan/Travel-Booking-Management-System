import apiClient from "../api/client";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getAdminOverview() {
  const response = await apiClient.get("/admin/overview");
  return response.data;
  // { metrics: [{label, value}], bookings: [...], payments: [...] }
}

// ─── Generic resource CRUD ────────────────────────────────────────────────────
// resourceKey: "operators" | "locations" | "vehicles" | "routes" |
//              "bookings" | "payments" | "cancellations"

export async function getAdminResource(resourceKey) {
  const response = await apiClient.get(`/admin/${resourceKey}`);
  return response.data; // array of records
}

export async function upsertAdminResource(resourceKey, record) {
  if (record.id) {
    const response = await apiClient.put(
      `/admin/${resourceKey}/${record.id}`,
      record
    );
    return response.data;
  }
  const response = await apiClient.post(`/admin/${resourceKey}`, record);
  return response.data;
}

export async function deleteAdminResource(resourceKey, recordId) {
  const response = await apiClient.delete(
    `/admin/${resourceKey}/${recordId}`
  );
  return response.data;
}

// ─── Form option helpers ──────────────────────────────────────────────────────
// These fetch the dropdown data needed for the Routes and Vehicles forms.

export async function getRouteFormOptions() {
  const response = await apiClient.get("/admin/form-options/routes");
  return response.data;
  // { modes, locations, operators, vehicles, weekDays }
  // each item: { value, label }
}

export async function getVehicleFormOptions() {
  const response = await apiClient.get("/admin/form-options/vehicles");
  return response.data;
  // { modes, operators }
  // each item: { value, label }
}
