import AuthLayout from "../layouts/AuthLayout";
import LoginForm from "../components/auth/LoginForm";

export default function Login({ onAuthenticated, onForgotPassword, notice }) {
  return <AuthLayout><LoginForm onAuthenticated={onAuthenticated} onForgotPassword={onForgotPassword} notice={notice} /></AuthLayout>;
}
