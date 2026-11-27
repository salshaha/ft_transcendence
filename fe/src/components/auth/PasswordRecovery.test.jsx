import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordForm from "./ForgotPasswordForm";
import ResetPasswordForm from "./ResetPasswordForm";
import { useAuthView } from "../../hooks/useAuthView";

vi.mock("../../services/passwordResetService", async () => {
  const actual = await vi.importActual("../../services/passwordResetService");
  return {
    ...actual,
    requestPasswordReset: vi.fn(),
    validatePasswordResetToken: vi.fn(),
    confirmPasswordReset: vi.fn(),
  };
});

import {
  GENERIC_RESET_MESSAGE,
  confirmPasswordReset,
  requestPasswordReset,
  validatePasswordResetToken,
} from "../../services/passwordResetService";

function AuthViewProbe() {
  const { view, token, email } = useAuthView();
  return (
    <div>
      <span data-testid="view">{view}</span>
      <span data-testid="token">{token}</span>
      <span data-testid="email">{email}</span>
    </div>
  );
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates email client-side before calling the API", () => {
    render(<ForgotPasswordForm onBackToLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid email address.");
    expect(requestPasswordReset).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "invalid-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid email address.");
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("shows loading state, generic confirmation, and supports resending", async () => {
    let resolveRequest;
    requestPasswordReset.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<ForgotPasswordForm initialEmail="student@example.com" onBackToLogin={vi.fn()} />);

    const submitButton = screen.getByRole("button", { name: /send reset link/i });
    fireEvent.click(submitButton);

    expect(screen.getByRole("button", { name: /sending\.\.\./i }).disabled).toBe(true);

    resolveRequest({ message: GENERIC_RESET_MESSAGE });

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(GENERIC_RESET_MESSAGE),
    );
    expect(requestPasswordReset).toHaveBeenCalledWith("student@example.com");

    const resendButton = screen.getByRole("button", { name: /resend reset link/i });
    expect(resendButton.disabled).toBe(false);

    requestPasswordReset.mockResolvedValueOnce({ message: GENERIC_RESET_MESSAGE });
    fireEvent.click(resendButton);
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledTimes(2));
  });

  it("displays API errors such as unconfigured service and navigates back to login", async () => {
    requestPasswordReset.mockRejectedValueOnce(
      new Error("Password reset email service is currently unavailable. Please try again later."),
    );
    const onBackToLogin = vi.fn();

    render(<ForgotPasswordForm onBackToLogin={onBackToLogin} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Password reset email service is currently unavailable",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles missing token and allows requesting a new link or returning to login", async () => {
    const onBackToLogin = vi.fn();
    render(
      <ResetPasswordForm
        token=""
        initialEmail="alice@example.com"
        onBackToLogin={onBackToLogin}
        onSuccess={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("missing or invalid"),
    );
    expect(validatePasswordResetToken).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /request a new reset link/i }));
    expect(onBackToLogin).toHaveBeenCalledWith(true, "alice@example.com");

    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(onBackToLogin).toHaveBeenCalledWith(false);
  });

  it("handles expired or invalid tokens returned by validation", async () => {
    validatePasswordResetToken.mockRejectedValueOnce(
      new Error("Invalid or expired reset token"),
    );
    const onBackToLogin = vi.fn();

    render(
      <ResetPasswordForm
        token="expired-token"
        initialEmail="bob@example.com"
        onBackToLogin={onBackToLogin}
        onSuccess={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Invalid or expired reset token"),
    );

    fireEvent.click(screen.getByRole("button", { name: /request a new reset link/i }));
    expect(onBackToLogin).toHaveBeenCalledWith(true, "bob@example.com");
  });

  it("validates password length, password mismatch, and visibility toggles", async () => {
    validatePasswordResetToken.mockResolvedValueOnce({ valid: true });

    render(
      <ResetPasswordForm
        token="valid-token-123"
        onBackToLogin={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("New password", { selector: "input" })).toBeTruthy(),
    );

    const newPwInput = screen.getByLabelText("New password", { selector: "input" });
    const confirmPwInput = screen.getByLabelText("Confirm password", { selector: "input" });
    expect(newPwInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: /show new password/i }));
    expect(newPwInput.type).toBe("text");

    fireEvent.change(newPwInput, { target: { value: "short" } });
    fireEvent.change(confirmPwInput, { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Password must be at least 8 characters",
    );
    expect(confirmPasswordReset).not.toHaveBeenCalled();

    fireEvent.change(newPwInput, { target: { value: "ValidPassword123!" } });
    fireEvent.change(confirmPwInput, { target: { value: "MismatchPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(screen.getByRole("alert").textContent).toBe("Passwords do not match.");
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("submits reset password, shows loading and success states, and navigates on login click", async () => {
    validatePasswordResetToken.mockResolvedValueOnce({ valid: true });
    let resolveConfirm;
    confirmPasswordReset.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const onSuccess = vi.fn();

    render(
      <ResetPasswordForm
        token="valid-token-123"
        onBackToLogin={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("New password", { selector: "input" })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("New password", { selector: "input" }), {
      target: { value: "NewSecurePass123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password", { selector: "input" }), {
      target: { value: "NewSecurePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    expect(screen.getByRole("button", { name: /resetting\.\.\./i }).disabled).toBe(true);

    resolveConfirm({ message: "Password reset successfully" });

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("password has been reset"),
    );
    expect(confirmPasswordReset).toHaveBeenCalledWith({
      token: "valid-token-123",
      newPassword: "NewSecurePass123!",
      confirmPassword: "NewSecurePass123!",
    });

    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("handles token errors returned during confirm submission", async () => {
    validatePasswordResetToken.mockResolvedValueOnce({ valid: true });
    confirmPasswordReset.mockRejectedValueOnce(new Error("Invalid or expired reset token"));

    render(
      <ResetPasswordForm
        token="valid-token-123"
        onBackToLogin={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("New password", { selector: "input" })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("New password", { selector: "input" }), {
      target: { value: "NewSecurePass123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password", { selector: "input" }), {
      target: { value: "NewSecurePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Invalid or expired reset token"),
    );
    expect(screen.getByRole("button", { name: /request a new reset link/i })).toBeTruthy();
  });
});

describe("useAuthView", () => {
  it("extracts reset-password view and token from both path and query routes", () => {
    window.history.replaceState({}, "", "/reset-password?token=abc-path-token");
    const first = render(<AuthViewProbe />);
    expect(screen.getByTestId("view").textContent).toBe("reset-password");
    expect(screen.getByTestId("token").textContent).toBe("abc-path-token");
    first.unmount();

    window.history.replaceState({}, "", "/?view=reset-password&token=abc-query-token");
    render(<AuthViewProbe />);
    expect(screen.getByTestId("view").textContent).toBe("reset-password");
    expect(screen.getByTestId("token").textContent).toBe("abc-query-token");
  });
});
