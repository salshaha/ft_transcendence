import { useEffect, useState } from "react";
import {
  confirmPasswordReset,
  validateResetPassword,
} from "../../services/passwordResetService";
import PasswordInput from "./PasswordInput";

export default function ResetPasswordForm({
  token: initialToken = "",
  initialEmail = "",
  onBackToLogin,
  onSuccess,
}) {
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setToken(initialToken);
  }, [initialToken]);

  function handleChange(setter) {
    return (event) => {
      setter(event.target.value);
      setError("");
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!token.trim()) {
      setError("Enter your reset token.");
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
      await confirmPasswordReset({ token, newPassword });
      onSuccess?.();
    } catch (requestError) {
      setError(requestError.message);
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
        <p>Reset tokens expire after one hour and can only be used once.</p>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <label>
          Reset token
          <input
            name="token"
            value={token}
            onChange={handleChange(setToken)}
            placeholder="Paste your reset token"
            autoComplete="off"
            required
          />
        </label>
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
        <button className="auth-link justify-self-start" type="button" onClick={onBackToLogin}>
          Back to sign in
        </button>
        <button
          className="auth-link justify-self-start"
          type="button"
          onClick={() => onBackToLogin(true, initialEmail)}
        >
          Need a new token?
        </button>
      </form>
    </div>
  );
}
