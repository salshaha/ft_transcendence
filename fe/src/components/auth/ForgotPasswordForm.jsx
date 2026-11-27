import { useState } from "react";
import {
  GENERIC_RESET_MESSAGE,
  isValidEmail,
  requestPasswordReset,
} from "../../services/passwordResetService";

export default function ForgotPasswordForm({
  initialEmail = "",
  onBackToLogin,
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [hasSent, setHasSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function submitResetRequest() {
    setError("");
    setMessage("");
    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setIsLoading(true);
    try {
      const data = await requestPasswordReset(normalizedEmail);
      setMessage(data?.message || GENERIC_RESET_MESSAGE);
      setHasSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitResetRequest();
  }

  return (
    <div className="form-shell">
      <div className="mobile-brand"><span className="brand-mark">N</span> Team-Platform</div>
      <div className="form-heading">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h2>Forgot password?</h2>
        <p>Enter your registered email address and we will send you a password reset link.</p>
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
              setHasSent(false);
            }}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        {error && <p className="form-message error" role="alert">{error}</p>}
        {message && (
          <div className="token-panel" role="status">
            <p className="form-message success">{message}</p>
            <p>
              Check your inbox and spam folder for the reset link. It expires
              after one hour and can only be used once.
            </p>
          </div>
        )}
        <button className="submit-button" type="submit" disabled={isLoading}>
          {isLoading
            ? "Sending..."
            : hasSent
              ? "Resend reset link  →"
              : "Send reset link  →"}
        </button>
        <button className="auth-link justify-self-start" type="button" onClick={onBackToLogin}>
          Back to sign in
        </button>
      </form>
    </div>
  );
}
