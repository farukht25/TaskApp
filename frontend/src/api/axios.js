//src/api/axios.js
import axios from "axios";
import { log } from "../utils/logger";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/";

const instance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// ---- Request Interceptor ----
// No Authorization header from JS; we use HttpOnly cookies + middleware
instance.interceptors.request.use((config) => {
  try {
    config.metadata = { t0: performance.now() };
    const hasAccess = (document.cookie || "").includes("access=");
    const hasRefresh = (document.cookie || "").includes("refresh=");
    log("http_request", {
      url: config.url,
      method: config.method,
      withCredentials: config.withCredentials,
      hasAccess,
      hasRefresh,
    });
  } catch (_) {}
  return config;
});

let isRefreshing = false;
let pendingRequests = [];

const runPending = (error) => {
  pendingRequests.forEach((cb) => cb(error));
  pendingRequests = [];
};

// ---- Response Interceptor (Handle 401 + Refresh Token) ----
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If token expired (401) and we haven’t retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const url = originalRequest.url || "";
      // Skip refresh loops for auth endpoints
      if (
        url.includes("auth/login") ||
        url.includes("auth/register") ||
        url.includes("auth/refresh") ||
        url.includes("user/me") ||
        url.includes("signout")
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request until refresh finishes
        return new Promise((resolve, reject) => {
          pendingRequests.push((refreshErr) => {
            if (refreshErr) return reject(refreshErr);
            resolve(instance(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        await axios.post(`${API_BASE}auth/refresh/`, {}, { withCredentials: true });
        isRefreshing = false;
        runPending(null);
        return instance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        runPending(refreshError);
        console.error("Token refresh failed:", refreshError);
        return Promise.reject(refreshError);
      }
    }

    try {
      const dt = originalRequest?.metadata?.t0 ? Math.round(performance.now() - originalRequest.metadata.t0) : undefined;
      log("http_error", {
        url: originalRequest?.url,
        status: error.response?.status,
        retried: !!originalRequest?._retry,
        dt_ms: dt,
      });
    } catch (_) {}
    return Promise.reject(error);
  }
);

// Log successful responses
instance.interceptors.response.use((resp) => {
  try {
    const cfg = resp.config || {};
    const dt = cfg?.metadata?.t0 ? Math.round(performance.now() - cfg.metadata.t0) : undefined;
    log("http_response", { url: cfg.url, status: resp.status, dt_ms: dt });
  } catch (_) {}
  return resp;
});

export default instance;
export { API_BASE };
