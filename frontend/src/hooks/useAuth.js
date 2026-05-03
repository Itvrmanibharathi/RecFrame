import { useState, useEffect, useCallback } from "react";
import client from "../api/client";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("rf_token");
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await client.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("rf_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await client.post("/auth/login", { email, password });
    localStorage.setItem("rf_token", data.access_token);
    await fetchMe();
  };

  const register = async (email, password) => {
    const { data } = await client.post("/auth/register", { email, password });
    localStorage.setItem("rf_token", data.access_token);
    await fetchMe();
  };

  const logout = () => {
    localStorage.removeItem("rf_token");
    setUser(null);
  };

  return { user, loading, login, register, logout };
}
