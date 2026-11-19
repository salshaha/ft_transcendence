import Login from "./pages/Login";
import InstructorDashboard from "./pages/InstructorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import { logoutUser } from "./services/authService";
import { useState } from "react";

export default function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  async function handleLogout() {
    setError("");
    try {
      await logoutUser();
      setUser(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (user?.role === "instructor" || user?.role === "student") {
    return (
      <>
        {error && (
          <p className="fixed bottom-4 right-4 z-[70] rounded-xl bg-[#fff0f0] p-4 text-xs text-[#a94646]" role="alert">
            {error}
          </p>
        )}
        {user.role === "instructor" ? (
          <InstructorDashboard onLogout={handleLogout} />
        ) : (
          <StudentDashboard onLogout={handleLogout} />
        )}
      </>
    );
  }

  return <Login onAuthenticated={setUser} />;
}
