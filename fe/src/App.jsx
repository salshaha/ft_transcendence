import Login from "./pages/Login";
import InstructorDashboard from "./pages/InstructorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { getSession, logoutUser } from "./services/authService";
import { useEffect, useState } from "react";

export default function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [restoringSession, setRestoringSession] = useState(true);

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

  if (restoringSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5faf9] text-sm text-[#6d898b]" role="status">
        Restoring your session...
      </main>
    );
  }

  if (user?.role === "admin" || user?.role === "instructor" || user?.role === "student") {
    return (
      <>
        {error && (
          <p className="fixed bottom-4 right-4 z-[70] rounded-xl bg-[#fff0f0] p-4 text-xs text-[#a94646]" role="alert">
            {error}
          </p>
        )}
        {user.role === "admin" ? (
          <AdminDashboard onLogout={handleLogout} />
        ) : user.role === "instructor" ? (
          <InstructorDashboard onLogout={handleLogout} />
        ) : (
          <StudentDashboard onLogout={handleLogout} />
        )}
      </>
    );
  }

  return <Login onAuthenticated={setUser} />;
}
