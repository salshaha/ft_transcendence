import { apiRequest } from "./apiClient";

export function getSession() {
  return apiRequest("/api/auth/session", {
    errorMessage: "Unable to restore your session.",
  });
}

export function loginUser({ email, password }) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    payload: { email, password },
  });
}

export function registerUser({ first_name, last_name, student_id, email, password }) {
  return apiRequest("/api/auth/register", {
    method: "POST",
    payload: {
      first_name,
      last_name,
      student_id,
      email,
      password,
      role: "student",
    },
  });
}

export function logoutUser() {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

export function getMicrosoftAuthStatus() {
  return apiRequest("/api/auth/microsoft/status", {
    errorMessage: "Unable to check Microsoft sign-in availability.",
  });
}

export function startMicrosoftLogin() {
  window.location.assign("/api/auth/microsoft/login");
}
