import AuthLayout from "../layouts/AuthLayout";
import LoginForm from "../components/auth/LoginForm";

export default function Login({ onAuthenticated }) {
  return <AuthLayout><LoginForm onAuthenticated={onAuthenticated} /></AuthLayout>;
}
