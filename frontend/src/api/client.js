import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",
  timeout: 10000,
});

// Attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("travel_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 (token expired or invalid)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("travel_current_user");
      sessionStorage.removeItem("travel_auth_token");
      // Redirect to appropriate login page
      const currentPath = window.location.pathname;
      const isAdmin = currentPath.startsWith("/admin");
      window.location.href = isAdmin ? "/login/admin" : "/login/user";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
