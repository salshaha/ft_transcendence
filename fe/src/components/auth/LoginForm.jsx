import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const initialValues = { name: "", email: "", password: "", role: "student" };

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
    if (result) {
      setSuccess(isLogin ? "You are signed in!" : "Your account is ready!");
      if (isLogin) onAuthenticated(result.user);
    }
  }

  return (
    <div className="form-shell">
      <div className="mobile-brand"><span className="brand-mark">P</span> pingora</div>
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
        {!isLogin && <label>Full name<input name="name" value={values.name} onChange={handleChange} placeholder="Your name" required /></label>}
        <label>Email address<input name="email" type="email" value={values.email} onChange={handleChange} placeholder="you@example.com" required /></label>
        <label>Password<input name="password" type="password" value={values.password} onChange={handleChange} placeholder="••••••••" minLength="6" required /></label>
        <fieldset className="role-picker">
          <legend>I am joining as a...</legend>
          <div className="role-options">
            {["student", "instructor"].map((role) => (
              <label className={`role-option ${values.role === role ? "selected" : ""}`} key={role}>
                <input type="radio" name="role" value={role} checked={values.role === role} onChange={handleChange} />
                <span className="role-icon">{role === "student" ? "✎" : "◆"}</span>
                <span>{role[0].toUpperCase() + role.slice(1)}</span><span className="radio-dot" />
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="form-message error" role="alert">{error}</p>}
        {success && <p className="form-message success" role="status">{success}</p>}
        <button className="submit-button" type="submit" disabled={isLoading}>{isLoading ? "Please wait..." : isLogin ? "Continue to Pingora  →" : "Create my account  →"}</button>
      </form>
      <p className="legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>
    </div>
  );
}
