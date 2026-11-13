const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function getInstructorDashboard() {
  const response = await fetch(`${API_URL}/api/instructor/dashboard`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Unable to load the instructor dashboard.");
  }
  return data;
}
