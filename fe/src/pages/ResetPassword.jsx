import AuthLayout from "../layouts/AuthLayout";
import ResetPasswordForm from "../components/auth/ResetPasswordForm";

export default function ResetPassword({ token, email, onBackToLogin, onSuccess }) {
  return (
    <AuthLayout>
      <ResetPasswordForm
        token={token}
        initialEmail={email}
        onBackToLogin={onBackToLogin}
        onSuccess={onSuccess}
      />
    </AuthLayout>
  );
}
