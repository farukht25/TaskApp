import { clientLog } from "./clientLog";

// Simple in-memory de-dup to avoid spamming identical logs repeatedly
const last = new Map();

function shouldSkip(key, windowMs = 1000) {
  const now = Date.now();
  const prev = last.get(key) || 0;
  if (now - prev < windowMs) return true;
  last.set(key, now);
  return false;
}

export function log(event, meta = {}, level = "info") {
  try {
    const key = `${event}:${JSON.stringify(meta)}`;
    // Allow fast console visibility
    // eslint-disable-next-line no-console
    console[level === "error" ? "error" : level === "warn" ? "warn" : "debug"](
      `[log] ${event}`,
      meta
    );
    // Send to backend with light de-dup
    if (!shouldSkip(key, 750)) clientLog(event, meta);
  } catch (_) {}
}

export function warn(event, meta = {}) {
  log(event, meta, "warn");
}

export function error(event, meta = {}) {
  log(event, meta, "error");
}

