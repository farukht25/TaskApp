// Bridge browser console errors/warnings to backend via /client-log/
// so they appear in `docker compose logs` (backend service).
import { clientLog } from "./clientLog";

function safeSerialize(arg) {
  try {
    if (arg instanceof Error) {
      return { message: arg.message, name: arg.name, stack: arg.stack };
    }
    if (typeof arg === "object") {
      return JSON.parse(JSON.stringify(arg));
    }
    return String(arg);
  } catch (_) {
    try { return String(arg); } catch (_) { return "<unserializable>"; }
  }
}

// Avoid echoing our structured logger messages (they start with "[log]")
function isStructuredLog(args) {
  try { return typeof args?.[0] === "string" && args[0].startsWith("[log]"); } catch { return false; }
}

// Patch console.error and console.warn
(() => {
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = function bridgedError(...args) {
    try {
      if (!isStructuredLog(args)) {
        const payload = { level: "error", args: args.map(safeSerialize) };
        clientLog("console_error", payload);
      }
    } catch (_) {}
    return origError(...args);
  };

  console.warn = function bridgedWarn(...args) {
    try {
      if (!isStructuredLog(args)) {
        const payload = { level: "warn", args: args.map(safeSerialize) };
        clientLog("console_warn", payload);
      }
    } catch (_) {}
    return origWarn(...args);
  };
})();

// Global error and unhandled promise rejection -> backend
window.addEventListener("error", (ev) => {
  try {
    const e = ev?.error;
    clientLog("window_error", {
      message: ev?.message,
      source: ev?.filename,
      lineno: ev?.lineno,
      colno: ev?.colno,
      stack: e?.stack,
      name: e?.name,
    });
  } catch (_) {}
});

window.addEventListener("unhandledrejection", (ev) => {
  try {
    const r = ev?.reason;
    clientLog("unhandled_rejection", {
      reason: r?.message || String(r),
      name: r?.name,
      stack: r?.stack,
    });
  } catch (_) {}
});

