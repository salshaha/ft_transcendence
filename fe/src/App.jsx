import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import InstructorDashboard from "./pages/InstructorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { getSession, logoutUser } from "./services/authService";
import { useEffect, useState } from "react";

export default function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [restoringSession, setRestoringSession] = useState(true);
  const { view, token, email, navigate } = useAuthView();

  useEffect(() => {
    let active = true;
    getSession()
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setRestoringSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    setError("");
    try {
      await logoutUser();
      setUser(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function showLogin() {
    setNotice("");
    navigate("login");
  }

  function showForgotPassword(address = "") {
    setError("");
    setNotice("");
    navigate("forgot-password", { email: address });
  }

  function handleAuthenticated(nextUser) {
    setUser(nextUser);
    setNotice("");
    navigate("login", { replace: true });
  }

  async function handlePasswordResetSuccess() {
    if (user) {
      try {
        await logoutUser();
      } catch (requestError) {
        setError(requestError.message);
      }
      setUser(null);
    }
    setNotice("Your password has been reset. Sign in with your new password.");
    navigate("login", { replace: true });
  }

  const toast = error ? (
    <p className="fixed bottom-4 right-4 z-[70] rounded-xl bg-[#fff0f0] p-4 text-xs text-[#a94646]" role="alert">
      {error}
    </p>
  ) : null;

  if (restoringSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5faf9] text-sm text-[#6d898b]" role="status">
        Restoring your session...
      </main>
    );
  }

  if (user?.role === "admin" || user?.role === "instructor" || user?.role === "student") {
  if (view === "forgot-password" || view === "reset-password") {
    return (
      <>
        {toast}
        {view === "forgot-password" ? (
          <ForgotPassword
            initialEmail={email}
            onBackToLogin={showLogin}
            onTokenReady={(resetToken, address) =>
              navigate("reset-password", { token: resetToken, email: address, replace: true })
            }
          />
        ) : (
          <ResetPassword
            token={token}
            email={email}
            onBackToLogin={(requestNewToken, address) =>
              requestNewToken ? showForgotPassword(address || email) : showLogin()
            }
            onSuccess={handlePasswordResetSuccess}
          />
        )}
        {user.role === "admin" ? (
          <AdminDashboard onLogout={handleLogout} />
        ) : user.role === "instructor" ? (
          <InstructorDashboard onLogout={handleLogout} />
      </>
    );
  }

  if (user?.role === "instructor" || user?.role === "student") {
    return (
      <>
        {toast}
        {user.role === "instructor" ? (
          <InstructorDashboard onLogout={handleLogout} onRequestPasswordReset={showForgotPassword} />
        ) : (
          <StudentDashboard onLogout={handleLogout} onRequestPasswordReset={showForgotPassword} />
        )}
      </>
    );
  }

  if (user?.role === "admin") {
    return (
      <>
        {toast}
        <AdminSettings
          user={user}
          onLogout={handleLogout}
          onRequestPasswordReset={showForgotPassword}
        />
      </>
    );
  }

  return (
    <>
      {toast}
      <Login
        onAuthenticated={handleAuthenticated}
        onForgotPassword={showForgotPassword}
        notice={notice}
      />
    </>
  );
}
