import { API_URL as DEFAULT_API_URL, apiDownload, apiRequest } from "./apiClient";

const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

export function getAdminDashboard() {
  return apiRequest("/api/admin/dashboard", {
    errorMessage: "Unable to retrieve admin dashboard.",
  });
}

export function getAdminUsers({ search = "", role = "", page = 1, perPage = 50 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (role) params.set("role", role);
  params.set("page", page);
  params.set("per_page", perPage);
  const query = params.toString();
  return apiRequest(`/api/admin/users${query ? `?${query}` : ""}`, {
    errorMessage: "Unable to retrieve users.",
  });
}

export function createAdminUser(payload) {
  return apiRequest("/api/admin/users", {
    method: "POST",
    payload,
    errorMessage: "Unable to create user.",
  });
}

export function updateAdminUser(userId, payload) {
  return apiRequest(`/api/admin/users/${userId}`, {
    method: "PUT",
    payload,
    errorMessage: "Unable to update user.",
  });
}

export function deleteAdminUser(userId) {
  return apiRequest(`/api/admin/users/${userId}`, {
    method: "DELETE",
    errorMessage: "Unable to delete user.",
  });
}

export function getAdminCourses() {
  return apiRequest("/api/admin/courses", {
    errorMessage: "Unable to retrieve courses.",
  });
}

export function createAdminCourse(payload) {
  return apiRequest("/api/admin/courses", {
    method: "POST",
    payload,
    errorMessage: "Unable to create course.",
  });
}

export function updateAdminCourse(courseId, payload) {
  return apiRequest(`/api/admin/courses/${courseId}`, {
    method: "PUT",
    payload,
    errorMessage: "Unable to update course.",
  });
}

export function deleteAdminCourse(courseId) {
  return apiRequest(`/api/admin/courses/${courseId}`, {
    method: "DELETE",
    errorMessage: "Unable to delete course.",
  });
}

export function enrollStudentInCourse(courseId, studentId) {
  return apiRequest(`/api/admin/courses/${courseId}/students`, {
    method: "POST",
    payload: { student_id: studentId },
    errorMessage: "Unable to enroll student.",
  });
}

export function removeStudentFromCourse(courseId, studentId) {
  return apiRequest(`/api/admin/courses/${courseId}/students/${studentId}`, {
    method: "DELETE",
    errorMessage: "Unable to remove student.",
  });
}

export function getAdminPeerFeedback({ projectId, studentId } = {}) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (studentId) params.set("student_id", studentId);
  const query = params.toString();
  return apiRequest(`/api/admin/peer-feedback${query ? `?${query}` : ""}`, {
    errorMessage: "Unable to retrieve peer feedback.",
  });
}

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
  let connectTimer = null;
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

  // Defer initial WebSocket creation past React StrictMode's synchronous cleanup.
  connectTimer = window.setTimeout(() => {
    connectTimer = null;
    connect();
  }, 0);

  return {
    isConnected: () => socket?.readyState === WebSocket.OPEN,
    close: () => {
      stopped = true;
      if (connectTimer) window.clearTimeout(connectTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (!socket) return;
      if (socket.readyState === WebSocket.CONNECTING) {
        const pending = socket;
        pending.onopen = () => pending.close(1000, "Dashboard closed");
        pending.onerror = null;
        pending.onclose = null;
      } else {
        socket.close(1000, "Dashboard closed");
      }
    },
  };
}
