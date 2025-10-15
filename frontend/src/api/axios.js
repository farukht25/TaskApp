//src/api/axios.js
import axios from "axios";

const instance = axios.create({
  baseURL: "http://localhost:8000/",
  withCredentials: true,
});

// ---- Request Interceptor ----
// No Authorization header from JS; we use HttpOnly cookies + middleware
instance.interceptors.request.use((config) => config);

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
        url.includes("user/me")
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
        await axios.post("http://localhost:8000/auth/refresh/", {}, { withCredentials: true });
        isRefreshing = false;
        runPending(null);
        return instance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        runPending(refreshError);
        console.error("Token refresh failed:", refreshError);
        window.location.href = "/signin";
      }
    }

    return Promise.reject(error);
  }
);

export default instance;
