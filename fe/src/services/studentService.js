import { apiRequest } from "./apiClient";

export function getStudentDashboard() {
  return apiRequest("/api/student/dashboard");
}

export function getStudentProfile() {
  return apiRequest("/api/student/profile");
}

export function getStudentCourses() {
  return apiRequest("/api/student/courses");
}

export function joinStudentTeam(teamId) {
  return apiRequest(`/api/student/teams/${teamId}/join`, { method: "POST" });
}

export function updateStudentAccount({ email, currentPassword }) {
  return apiRequest("/api/update_info", {
    method: "PUT",
    payload: {
      email,
      current_password: currentPassword,
    },
  });
}
