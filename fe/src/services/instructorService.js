import { API_URL, apiRequest } from "./apiClient";

export async function getInstructorDashboard() {
  return apiRequest("/api/instructor/dashboard", {
    errorMessage: "Unable to load the instructor dashboard.",
  });
}

export async function getInstructorCourses() {
  return apiRequest("/api/instructor/courses", {
    errorMessage: "Unable to load your courses.",
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

export async function fetchInstructorFile(path, errorMessage = "Unable to open file.") {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || errorMessage)
  }
  return {
    blob: await response.blob(),
    contentType: response.headers.get("Content-Type") || "application/octet-stream",
  }
}

export function saveFileBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName || "download"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadInstructorProjectRequirements(projectId, fileName) {
  const { blob } = await fetchInstructorFile(
    `/api/instructor/projects/${projectId}/requirements?download=1`,
    "Unable to download project requirements.",
  )
  saveFileBlob(blob, fileName || "project-requirements.pdf")
}

export async function getInstructorCourseStudents(courseId) {
  return apiRequest(`/api/instructor/courses/${courseId}/students`, {
    errorMessage: "Unable to load enrolled students.",
  })
}

export async function getInstructorStudentProfile(studentId) {
  return apiRequest(`/api/instructor/students/${studentId}`, {
    errorMessage: "Unable to load the student profile.",
  })
}

export async function getInstructorSubmissions() {
  return apiRequest("/api/instructor/submissions", {
    errorMessage: "Unable to load team submissions.",
  })
}

export function instructorSubmissionFileUrl(submissionId, download = false) {
  return `/api/instructor/submissions/${submissionId}/file${download ? "?download=1" : ""}`
}

export function instructorStudentAvatarUrl(studentId) {
  return `/api/instructor/students/${studentId}/avatar`
}
