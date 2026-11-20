import { apiRequest } from "./apiClient";

export async function getInstructorDashboard() {
  return apiRequest("/api/instructor/dashboard", {
    errorMessage: "Unable to load the instructor dashboard.",
  });
}
