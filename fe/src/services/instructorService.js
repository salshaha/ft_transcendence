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

export async function syncMicrosoftCourses() {
  return apiRequest("/api/instructor/microsoft/sync-courses", {
    method: "POST",
    errorMessage: "Unable to sync Microsoft classes.",
  });
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
  return `/api/instructor/students/${studentId}/avatar`;
}

function optionalFilter(value) {
  return value === null || value === undefined || value === "" || value === "all"
    ? null
    : value;
}

export async function getInstructorGrades(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const filterValue = optionalFilter(value);
    if (filterValue !== null) params.set(key, String(filterValue));
  }
  const query = params.toString();
  return apiRequest(`/api/instructor/grades${query ? `?${query}` : ""}`, {
    errorMessage: "Unable to load grades.",
  });
}

export async function saveInstructorGrade(payload, gradeId = null) {
  return apiRequest(
    gradeId ? `/api/instructor/grades/${gradeId}` : "/api/instructor/grades",
    {
      method: gradeId ? "PUT" : "POST",
      payload,
      errorMessage: "Unable to save the grade.",
    },
  );
}

export async function setInstructorGradePublished(gradeId, published) {
  return apiRequest(`/api/instructor/grades/${gradeId}/publish`, {
    method: "PUT",
    payload: { published },
    errorMessage: "Unable to update the grade publication status.",
  });
}

export async function publishAllInstructorGrades(scope) {
  return apiRequest("/api/instructor/grades/publish-all", {
    method: "POST",
    payload: scope,
    errorMessage: "Unable to publish grades.",
  });
}

export async function getInstructorGradeAudit(gradeId) {
  return apiRequest(`/api/instructor/grades/${gradeId}/audit`, {
    errorMessage: "Unable to load grade history.",
  });
}

export async function getInstructorTeamKanban(teamId, projectId = null) {
  const query = projectId ? `?project_id=${projectId}` : "";
  return apiRequest(`/api/instructor/teams/${teamId}/kanban${query}`, {
    errorMessage: "Unable to load the team board.",
  });
}
