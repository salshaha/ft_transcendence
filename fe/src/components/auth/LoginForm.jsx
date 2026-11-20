import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const initialValues = { first_name: "", last_name: "", student_id: "", email: "", password: "" };

export default function LoginForm({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [values, setValues] = useState(initialValues);
  const [success, setSuccess] = useState("");
  const { submit, isLoading, error, clearError } = useAuth();
  const isLogin = mode === "login";

  function changeMode(nextMode) {
    setMode(nextMode);
    setSuccess("");
    clearError();
  }

  function handleChange(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (error) clearError();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await submit(values, mode);
    if (!result) return;
    if (isLogin) {
      onAuthenticated?.(result.user);
      setSuccess("You are signed in!");
    } else {
      setSuccess("Your account is ready!");
    }
  }

  return (
    <div className="form-shell">
      <div className="mobile-brand"><span className="brand-mark">N</span> Team-Platform</div>
      <div className="form-heading">
        <p className="eyebrow">YOUR SPACE AWAITS</p>
        <h2>{isLogin ? "Welcome back." : "Create your account."}</h2>
        <p>{isLogin ? "Sign in to pick up where you left off." : "Join a community built around your goals."}</p>
      </div>
      <div className="mode-switch" role="tablist" aria-label="Authentication mode">
        <button className={isLogin ? "active" : ""} onClick={() => changeMode("login")} role="tab" aria-selected={isLogin}>Sign in</button>
        <button className={!isLogin ? "active" : ""} onClick={() => changeMode("register")} role="tab" aria-selected={!isLogin}>Sign up</button>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        {!isLogin && <label>First name<input name="first_name" value={values.first_name} onChange={handleChange} placeholder="Your first name" required /></label>}
        {!isLogin && <label>Last name<input name="last_name" value={values.last_name} onChange={handleChange} placeholder="Your last name" required /></label>}
        <label>Email address<input name="email" type="email" value={values.email} onChange={handleChange} placeholder="you@example.com" required /></label>
        <label>Password<input name="password" type="password" value={values.password} onChange={handleChange} placeholder="At least 8 characters" minLength="8" required /></label>
        {!isLogin && (
          <label>Student ID<input name="student_id" value={values.student_id} onChange={handleChange} placeholder="Your student ID" required /></label>
        )}
        {!isLogin && (
          <p className="role-note">
            Student accounts can sign up here. Instructor accounts are created by an administrator.
          </p>
        )}
        {error && <p className="form-message error" role="alert">{error}</p>}
        {success && <p className="form-message success" role="status">{success}</p>}
        <button className="submit-button" type="submit" disabled={isLoading}>{isLoading ? "Please wait..." : isLogin ? "Continue to Team-Platform  →" : "Create my account  →"}</button>
      </form>
      <p className="legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>
    </div>
  );
}
