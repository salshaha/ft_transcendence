import { apiRequest } from "./apiClient";

export async function getInstructorDashboard() {
  return apiRequest("/api/instructor/dashboard", {
    errorMessage: "Unable to load the instructor dashboard.",
  });
}

export async function createCourseProject(courseId, project) {
  return apiRequest(`/api/instructor/courses/${courseId}/project`, {
    method: "POST",
    payload: project,
    errorMessage: "Unable to create the project.",
  });
}

export async function updateInstructorProject(projectId, project) {
  return apiRequest(`/api/instructor/projects/${projectId}`, {
    method: "PUT",
    payload: project,
    errorMessage: "Unable to update the project.",
  });
}

export async function deleteInstructorProject(projectId) {
  return apiRequest(`/api/instructor/projects/${projectId}`, {
    method: "DELETE",
    errorMessage: "Unable to delete the project.",
  })
}

export async function getInstructorProjectTeams(projectId) {
  return apiRequest(`/api/instructor/projects/${projectId}/teams`, {
    errorMessage: "Unable to load course teams.",
  });
}

export async function uploadInstructorProjectRequirements(projectId, file) {
  const body = new FormData()
  body.append("file", file)
  return apiRequest(`/api/instructor/projects/${projectId}/requirements`, {
    method: "POST",
    body,
    errorMessage: "Unable to upload project requirements.",
  })
}

export async function downloadInstructorProjectRequirements(projectId, fileName) {
  const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")
  const response = await fetch(`${apiUrl}/api/instructor/projects/${projectId}/requirements`, {
    credentials: "include",
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || "Unable to download project requirements.")
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = fileName || "project-requirements.pdf"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
