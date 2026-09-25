import axios from "axios";
import { useAuthStore } from "../store/auth";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh once on 401, then retry the original request.
let refreshing = false;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (error.response?.status === 401 && !original._retry && refreshToken && !refreshing) {
      original._retry = true;
      refreshing = true;
      try {
        const { data } = await axios.post("/api/auth/refresh", {
          refresh_token: refreshToken,
        });
        setTokens(data.access_token, data.refresh_token, data.role);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        logout();
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
