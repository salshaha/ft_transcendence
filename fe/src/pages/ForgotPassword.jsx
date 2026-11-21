import AuthLayout from "../layouts/AuthLayout";
import ForgotPasswordForm from "../components/auth/ForgotPasswordForm";

export default function ForgotPassword({ initialEmail, onBackToLogin, onTokenReady }) {
  return (
    <AuthLayout>
      <ForgotPasswordForm
        initialEmail={initialEmail}
        onBackToLogin={onBackToLogin}
        onTokenReady={onTokenReady}
      />
    </AuthLayout>
  );
}
