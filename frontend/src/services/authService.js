import apiClient from "../api/client";

export async function login(credentials) {
  const response = await apiClient.post("/auth/login", {
    user_id: credentials.user_id,
    password: credentials.password,
    role: credentials.expectedRole,
  });
  return response.data; // { token, user: { id, user_id, name, full_name, email, phone, role, status } }
}

export async function register(payload) {
  const response = await apiClient.post("/auth/register", {
    user_id: payload.user_id,
    full_name: payload.full_name,
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
  });
  return response.data; // { token, user }
}
