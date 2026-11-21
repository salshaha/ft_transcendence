import { useState } from "react";
import {
  GENERIC_RESET_MESSAGE,
  isValidEmail,
  requestPasswordReset,
} from "../../services/passwordResetService";

export default function ForgotPasswordForm({
  initialEmail = "",
  onBackToLogin,
  onTokenReady,
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setToken("");
    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setIsLoading(true);
    try {
      const data = await requestPasswordReset(normalizedEmail);
      setMessage(data?.message || GENERIC_RESET_MESSAGE);
      if (typeof data?.reset_token === "string" && data.reset_token) {
        setToken(data.reset_token);
      }
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
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h2>Forgot password?</h2>
        <p>Enter your email address to request a one-time password reset token.</p>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <label>
          Email address
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
              setMessage("");
              setToken("");
            }}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        {error && <p className="form-message error" role="alert">{error}</p>}
        {message && <p className="form-message success" role="status">{message}</p>}
        {token && (
          <div className="token-panel">
            <p>
              Email delivery is not configured for this deployment. Use the
              issued token below to choose a new password.
            </p>
            <code>{token}</code>
            <button
              className="submit-button"
              type="button"
              onClick={() => onTokenReady(token, email.trim())}
            >
              Set new password  →
            </button>
          </div>
        )}
        <button className="submit-button" type="submit" disabled={isLoading}>
          {isLoading ? "Sending..." : "Continue  →"}
        </button>
        <button className="auth-link justify-self-start" type="button" onClick={onBackToLogin}>
          Back to sign in
        </button>
      </form>
    </div>
  );
}
