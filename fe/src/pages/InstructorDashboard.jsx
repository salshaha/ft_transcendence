import { useEffect, useState } from "react";
import { getInstructorDashboard } from "../services/instructorService";
import FigmaInstructorDashboard from "./FigmaInstructorDashboard";

export default function InstructorDashboard({ onLogout, onRequestPasswordReset }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getInstructorDashboard()
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5faf9] p-6 text-sm text-[#a94646]" role="alert">
        {error}
      </main>
    );
  }
  if (!dashboard) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5faf9] text-sm text-[#6d898b]" role="status">
        Loading your instructor dashboard...
      </main>
    );
  }

  return <FigmaInstructorDashboard dashboard={dashboard} onLogout={onLogout} onRequestPasswordReset={onRequestPasswordReset} />;
}
