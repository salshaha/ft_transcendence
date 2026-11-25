import { apiDownload, apiRequest } from "./apiClient";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

function dateParams({ start_date, end_date }) {
  const params = new URLSearchParams();
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);
  return params.toString();
}

export function getAdminAnalytics(range) {
  return apiRequest(`/api/admin/analytics?${dateParams(range)}`);
}

export function downloadAdminAnalytics(range) {
  return apiDownload(`/api/admin/analytics/export.csv?${dateParams(range)}`);
}

export function downloadAdminAnalyticsPdf(range) {
  return apiDownload(`/api/admin/analytics/export.pdf?${dateParams(range)}`);
}

export function downloadAdminData(entity, format) {
  const params = new URLSearchParams({ entity, format });
  return apiDownload(`/api/admin/data/export?${params.toString()}`);
}

export function importAdminData(entity, file) {
  const formData = new FormData();
  formData.append("entity", entity);
  formData.append("file", file);
  return apiRequest("/api/admin/data/import", {
    method: "POST",
    body: formData,
  });
}

export function subscribeToAdminAnalytics(onUpdate, onStatusChange) {
  let stopped = false;
  let retryCount = 0;
  let retryTimer = null;
  let socket = null;

  function scheduleReconnect() {
    if (stopped || retryTimer) return;
    onStatusChange("reconnecting");
    const delay = Math.min(1000 * 2 ** retryCount, 30000);
    retryCount += 1;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (stopped) return;
    onStatusChange("connecting");
    try {
      const url = new URL(API_URL);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = "/ws/admin-analytics";
      url.search = "";
      url.hash = "";
      socket = new WebSocket(url.toString());
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      retryCount = 0;
      onStatusChange("connected");
    };
    socket.onmessage = (event) => {
      try {
        if (JSON.parse(event.data).type === "analytics.changed") onUpdate();
      } catch {
        // Ignore malformed messages and keep the live connection open.
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => scheduleReconnect();
  }

  connect();
  return {
    isConnected: () => socket?.readyState === WebSocket.OPEN,
    close: () => {
      stopped = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      socket?.close(1000, "Dashboard closed");
    },
  };
}
