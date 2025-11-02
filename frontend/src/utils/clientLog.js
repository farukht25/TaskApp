import { API_BASE } from "../api/axios";

export function clientLog(event, meta = {}) {
  try {
    const payload = {
      event,
      meta,
      ts: new Date().toISOString(),
      url: typeof location !== "undefined" ? location.href : undefined,
    };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const endpoint = `${API_BASE}client-log/`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, blob);
      return;
    }
    fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}

