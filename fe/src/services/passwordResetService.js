import { apiRequest } from "./apiClient";

export const GENERIC_RESET_MESSAGE =
  "If the account exists, a reset token has been issued.";

export function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateResetPassword(value) {
  if (typeof value !== "string" || value.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (value.length > 1024) {
    return "Password must be 1024 characters or fewer";
  }
  return null;
}

export function requestPasswordReset(email) {
  return apiRequest("/api/auth/password-reset/request", {
    method: "POST",
    payload: { email: email.trim() },
    errorMessage: "Unable to request a password reset. Please try again.",
  });
}

export function confirmPasswordReset({ token, newPassword }) {
  return apiRequest("/api/auth/password-reset/confirm", {
    method: "POST",
    payload: { token: token.trim(), new_password: newPassword },
    errorMessage: "Unable to reset your password. Please try again.",
  });
}
