import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120_000,
});

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("rf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("rf_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default client;
