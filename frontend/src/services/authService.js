import apiClient from "../api/client";
import { readStorage, writeStorage } from "../utils/storage";

function mapUser(user) {
  return {
    id: user.user_id,
    user_id: user.user_id,
    name: user.full_name,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status
  };
}

function isValidUserId(value) {
  return /^[A-Za-z0-9]+$/.test(String(value || "").trim());
}

export async function login(credentials) {
  try {
    const response = await apiClient.post("/auth/login", credentials);
    return response.data;
  } catch (error) {
    const users = readStorage("users");
    const user = users.find(
      (entry) =>
        String(entry.user_id).toLowerCase() === String(credentials.user_id).trim().toLowerCase() &&
        entry.password_hash === credentials.password
    );

    if (!user) {
      throw new Error("Invalid user ID or password");
    }

    if (credentials.expectedRole && user.role !== credentials.expectedRole) {
      throw new Error(
        credentials.expectedRole === "admin"
          ? "Use the user login for customer bookings"
          : "Use the admin login for administrative access"
      );
    }

    return {
      token: `mock-token-${user.user_id}`,
      user: mapUser(user)
    };
  }
}

export async function register(payload) {
  try {
    const response = await apiClient.post("/auth/register", payload);
    return response.data;
  } catch (error) {
    const users = readStorage("users");
    const normalizedUserId = String(payload.user_id || "").trim();
    const userIdExists = users.some(
      (entry) => String(entry.user_id).toLowerCase() === normalizedUserId.toLowerCase()
    );
    const emailExists = users.some(
      (entry) => entry.email.toLowerCase() === payload.email.toLowerCase()
    );

    if (!isValidUserId(normalizedUserId)) {
      throw new Error("User ID must be unique and alphanumeric only");
    }

    if (userIdExists) {
      throw new Error("This user ID is already in use");
    }

    if (emailExists) {
      throw new Error("Account already exists for this email");
    }

    const user = {
      user_id: normalizedUserId,
      full_name: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      password_hash: payload.password,
      role: "user",
      created_at: new Date().toISOString(),
      status: "active"
    };

    writeStorage("users", [...users, user]);
    return {
      token: `mock-token-${user.user_id}`,
      user: mapUser(user)
    };
  }
}
