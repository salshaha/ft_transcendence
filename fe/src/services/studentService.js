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

export function getStudentCourseProject(courseId) {
  return apiRequest(`/api/student/courses/${courseId}/project`);
}

export function createStudentTeam({ projectId, name }) {
  return apiRequest("/api/student/teams", {
    method: "POST",
    payload: { project_id: projectId, name },
  });
}

export function openStudentProjectRequirements(projectId) {
  const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
  window.open(`${API_URL}/api/student/projects/${projectId}/requirements`, "_blank", "noopener,noreferrer");
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

export function getAvailableSkills(search = "", category = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  const query = params.toString();
  return apiRequest(`/api/skills${query ? `?${query}` : ""}`);
}

export function addStudentSkill({ skillId, name, category, proficiencyLevel = 3 }) {
  return apiRequest("/api/me/skills", {
    method: "POST",
    payload: {
      skill_id: skillId,
      name,
      category,
      proficiency_level: proficiencyLevel,
    },
  });
}

export function updateStudentSkill(skillId, proficiencyLevel) {
  return apiRequest(`/api/me/skills/${skillId}`, {
    method: "PUT",
    payload: { proficiency_level: proficiencyLevel },
  });
}

export function removeStudentSkill(skillId) {
  return apiRequest(`/api/me/skills/${skillId}`, { method: "DELETE" });
}
