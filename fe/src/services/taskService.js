import { apiRequest } from "./apiClient";
import { fetchInstructorFile } from "./instructorService";

export async function listTasks(teamId = null) {
  const query = teamId === null ? "" : `?team_id=${teamId}`;
  return apiRequest(`/api/tasks${query}`, {
    errorMessage: "Unable to load tasks.",
  });
}

export async function createTask(payload) {
  return apiRequest("/api/tasks", {
    method: "POST",
    payload,
    errorMessage: "Unable to create the task.",
  });
}

export async function updateTask(taskId, payload) {
  return apiRequest(`/api/tasks/${taskId}`, {
    method: "PUT",
    payload,
    errorMessage: "Unable to update the task.",
  });
}

export async function deleteTask(taskId) {
  return apiRequest(`/api/tasks/${taskId}`, {
    method: "DELETE",
    errorMessage: "Unable to delete the task.",
  });
}

export async function getTaskComments(taskId) {
  const response = await apiRequest(`/api/tasks/${taskId}/comments`, {
    errorMessage: "Unable to load comments.",
  });
  return response.comments || [];
}

export async function createTaskComment(taskId, body, kind = "comment") {
  const response = await apiRequest(`/api/tasks/${taskId}/comments`, {
    method: "POST",
    payload: { body, kind },
    errorMessage: "Unable to add a comment.",
  });
  return response.comment;
}

export function createTaskFeedback(taskId, body) {
  return createTaskComment(taskId, body, "instructor_feedback");
}

export async function updateTaskComment(commentId, body) {
  const response = await apiRequest(`/api/comments/${commentId}`, {
    method: "PUT",
    payload: { body },
    errorMessage: "Unable to update the comment.",
  });
  return response.comment;
}

export async function deleteTaskComment(commentId) {
  return apiRequest(`/api/comments/${commentId}`, {
    method: "DELETE",
    errorMessage: "Unable to delete the comment.",
  });
}

export async function getTaskAttachments(taskId) {
  const response = await apiRequest(`/api/tasks/${taskId}/attachments`, {
    errorMessage: "Unable to load attachments.",
  });
  return response.attachments || [];
}

export async function uploadTaskAttachment(taskId, file) {
  const body = new FormData();
  body.append("file", file);
  const response = await apiRequest(`/api/tasks/${taskId}/attachments`, {
    method: "POST",
    body,
    errorMessage: "Unable to upload the attachment.",
  });
  return response.attachment;
}

export function fetchTaskAttachment(attachmentId, download = false) {
  return fetchInstructorFile(
    `/api/attachments/${attachmentId}/file${download ? "?download=1" : ""}`,
    "Unable to open the attachment.",
  );
}

export async function deleteTaskAttachment(attachmentId) {
  return apiRequest(`/api/attachments/${attachmentId}`, {
    method: "DELETE",
    errorMessage: "Unable to delete the attachment.",
  });
}
