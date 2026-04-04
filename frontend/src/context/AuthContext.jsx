import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as loginUser, register as registerUser } from "../services/authService";
import { seedStorage } from "../utils/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedStorage();
    localStorage.removeItem("travel_current_user");
    localStorage.removeItem("travel_auth_token");

    const storedUser = sessionStorage.getItem("travel_current_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const persistSession = (session) => {
    sessionStorage.setItem("travel_current_user", JSON.stringify(session.user));
    sessionStorage.setItem("travel_auth_token", session.token);
    setUser(session.user);
  };

  const login = async (credentials) => {
    const session = await loginUser(credentials);
    persistSession(session);
    return session;
  };

  const register = async (payload) => {
    const session = await registerUser(payload);
    persistSession(session);
    return session;
  };

  const logout = () => {
    sessionStorage.removeItem("travel_current_user");
    sessionStorage.removeItem("travel_auth_token");
    localStorage.removeItem("travel_current_user");
    localStorage.removeItem("travel_auth_token");
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isUser: user?.role === "user",
      isAdmin: user?.role === "admin",
      login,
      register,
      logout
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
