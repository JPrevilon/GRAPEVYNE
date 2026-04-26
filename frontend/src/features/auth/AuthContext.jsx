import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthContext } from "./authContextValue.js";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
} from "./authApi.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const refreshUser = useCallback(async () => {
    setStatus("loading");

    try {
      const response = await getCurrentUser();
      setUser(response.data.user);
    } catch (error) {
      if (error.status !== 401) {
        console.error(error);
      }

      setUser(null);
    } finally {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signup = useCallback(async (payload) => {
    const response = await signupRequest(payload);
    setUser(response.data.user);
    setStatus("ready");
    return response.data.user;
  }, []);

  const login = useCallback(async (payload) => {
    const response = await loginRequest(payload);
    setUser(response.data.user);
    setStatus("ready");
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus("ready");
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading: status === "loading",
      login,
      logout,
      refreshUser,
      signup,
      status,
    }),
    [login, logout, refreshUser, signup, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
