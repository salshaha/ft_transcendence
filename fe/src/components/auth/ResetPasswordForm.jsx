import { useEffect, useState } from "react";
import {
  confirmPasswordReset,
  validatePasswordResetToken,
  validateResetPassword,
} from "../../services/passwordResetService";
import PasswordInput from "./PasswordInput";

export default function ResetPasswordForm({
  token = "",
  initialEmail = "",
  onBackToLogin,
  onSuccess,
}) {
  const trimmedToken = String(token || "").trim();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isValidatingToken, setIsValidatingToken] = useState(Boolean(trimmedToken));
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    setError("");
    setIsSuccess(false);

    if (!trimmedToken) {
      setTokenError("This password reset link is missing or invalid.");
      setIsValidatingToken(false);
      return () => {
        active = false;
      };
    }

    setTokenError("");
    setIsValidatingToken(true);
    validatePasswordResetToken(trimmedToken)
      .then(() => {
        if (active) {
          setTokenError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setTokenError(
            requestError.message || "This password reset link is invalid or has expired.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsValidatingToken(false);
        }
      });

    return () => {
      active = false;
    };
  }, [trimmedToken]);

  function handleChange(setter) {
    return (event) => {
      setter(event.target.value);
      setError("");
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!trimmedToken) {
      setTokenError("This password reset link is missing or invalid.");
      return;
    }
    const passwordError = validateResetPassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await confirmPasswordReset({
        token: trimmedToken,
        newPassword,
        confirmPassword,
      });
      setIsSuccess(true);
    } catch (requestError) {
      const message = requestError.message || "Unable to reset your password.";
      if (message.toLowerCase().includes("token")) {
        setTokenError(message);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="form-shell">
      <div className="mobile-brand"><span className="brand-mark">N</span> Team-Platform</div>
      <div className="form-heading">
        <p className="eyebrow">CHOOSE A NEW PASSWORD</p>
        <h2>Reset password.</h2>
        <p>Reset links expire after one hour and can only be used once.</p>
      </div>

      {isValidatingToken ? (
        <p className="form-message success" role="status">
          Verifying your reset link...
        </p>
      ) : isSuccess ? (
        <div className="grid gap-4">
          <p className="form-message success" role="status">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <button
            className="submit-button"
            type="button"
            onClick={() => onSuccess?.()}
          >
            Back to sign in  →
          </button>
        </div>
      ) : tokenError ? (
        <div className="grid gap-4">
          <p className="form-message error" role="alert">
            {tokenError}
          </p>
          <button
            className="submit-button"
            type="button"
            onClick={() => onBackToLogin?.(true, initialEmail)}
          >
            Request a new reset link  →
          </button>
          <button
            className="auth-link justify-self-start"
            type="button"
            onClick={() => onBackToLogin?.(false)}
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <PasswordInput
            label="New password"
            name="new_password"
            value={newPassword}
            onChange={handleChange(setNewPassword)}
            placeholder="At least 8 characters"
            minLength={8}
            autoComplete="new-password"
            required
          />
          <PasswordInput
            label="Confirm password"
            name="confirm_password"
            value={confirmPassword}
            onChange={handleChange(setConfirmPassword)}
            placeholder="Repeat your new password"
            minLength={8}
            autoComplete="new-password"
            required
          />
          {error && <p className="form-message error" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={isLoading}>
            {isLoading ? "Resetting..." : "Reset password  →"}
          </button>
          <button
            className="auth-link justify-self-start"
            type="button"
            onClick={() => onBackToLogin?.(false)}
          >
            Back to sign in
          </button>
          <button
            className="auth-link justify-self-start"
            type="button"
            onClick={() => onBackToLogin?.(true, initialEmail)}
          >
            Need a new reset link?
          </button>
        </form>
      )}
    </div>
  );
}
