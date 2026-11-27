import { apiRequest } from "./apiClient";

export const GENERIC_RESET_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

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
  return apiRequest("/api/auth/forgot-password", {
    method: "POST",
    payload: { email: email.trim() },
    errorMessage: "Unable to request a password reset. Please try again.",
  });
}

export function validatePasswordResetToken(token) {
  return apiRequest("/api/auth/reset-password/validate", {
    method: "POST",
    payload: { token: String(token || "").trim() },
    errorMessage: "Invalid or expired reset link.",
  });
}

export function confirmPasswordReset({ token, newPassword, confirmPassword }) {
  const payload = {
    token: String(token || "").trim(),
    new_password: newPassword,
  };
  if (confirmPassword !== undefined) {
    payload.confirm_password = confirmPassword;
  }
  return apiRequest("/api/auth/reset-password", {
    method: "POST",
    payload,
    errorMessage: "Unable to reset your password. Please try again.",
  });
}
