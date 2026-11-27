import AuthLayout from "../layouts/AuthLayout";
import ForgotPasswordForm from "../components/auth/ForgotPasswordForm";

export default function ForgotPassword({ initialEmail, onBackToLogin }) {
  return (
    <AuthLayout>
      <ForgotPasswordForm
        initialEmail={initialEmail}
        onBackToLogin={onBackToLogin}
      />
    </AuthLayout>
  );
}
