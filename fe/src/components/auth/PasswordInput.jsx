import { useState } from "react";

export default function PasswordInput({
  label = "Password",
  name,
  value,
  onChange,
  placeholder,
  required = false,
  minLength,
  autoComplete,
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label className="password-field">
      {label}
      <span className="password-input-shell">
        <input
          name={name}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minLength={minLength}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 6.5 9 6.5a14 14 0 01-2.1 3M6.2 6.2C4.2 7.7 3 10.5 3 10.5S6.5 17 12 17c1.1 0 2.1-.2 3-.6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          )}
        </button>
      </span>
    </label>
  );
}
