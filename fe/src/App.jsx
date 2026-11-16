import Login from "./pages/Login";
import InstructorDashboard from "./pages/InstructorDashboard";
import { useState } from "react";

export default function App() {
  const [user, setUser] = useState(null);
  if (user?.role === "instructor") {
    return <InstructorDashboard onLogout={() => setUser(null)} />;
  }
  return <Login onAuthenticated={setUser} />;
}
