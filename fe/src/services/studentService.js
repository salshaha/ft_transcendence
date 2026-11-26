import { API_URL, apiRequest } from "./apiClient";
import { fetchInstructorFile } from "./instructorService";
import { uploadWithProgress } from "./uploadService";

export function getStudentDashboard() {
  return apiRequest("/api/student/dashboard");
}

export function getStudentProfile() {
  return apiRequest("/api/student/profile");
}

export function getStudentCourses(search = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const query = params.toString();
  return apiRequest(`/api/student/courses${query ? `?${query}` : ""}`);
}

export function joinStudentTeam(teamId) {
  return apiRequest(`/api/student/teams/${teamId}/join`, { method: "POST" });
}

export function leaveStudentTeam(teamId) {
  return apiRequest(`/api/student/teams/${teamId}/leave`, { method: "POST" });
}

export function removeStudentTeamMember(teamId, memberId) {
  return apiRequest(`/api/student/teams/${teamId}/members/${memberId}`, {
    method: "DELETE",
  });
}

export function transferStudentTeamLeadership(teamId, newLeaderId) {
  return apiRequest(`/api/student/teams/${teamId}/leadership`, {
    method: "POST",
    payload: { new_leader_id: newLeaderId },
  });
}

export function getAvailableTeams() {
  return apiRequest("/api/student/teams/available");
}

export function getStudentTeamPreview(teamId) {
  return apiRequest(`/api/student/teams/${teamId}/preview`);
}

export function getStudentCourseProject(courseId) {
  return apiRequest(`/api/student/courses/${courseId}/project`);
}

export function getStudentCourseTeams(courseId, { projectId = null, search = "", availability = "" } = {}) {
  const params = new URLSearchParams();
  if (projectId !== null && projectId !== undefined && projectId !== "") params.set("project_id", projectId);
  if (search) params.set("search", search);
  if (availability) params.set("availability", availability);
  const query = params.toString();
  return apiRequest(`/api/student/courses/${courseId}/teams${query ? `?${query}` : ""}`);
}

export function getStudentTeams() {
  return apiRequest("/api/student/teams");
}

export function getStudentGrades() {
  return apiRequest("/api/student/grades", {
    errorMessage: "Unable to load your grades.",
  });
}

export function createStudentTeam({ projectId, name }) {
  return apiRequest("/api/student/teams", {
    method: "POST",
    payload: { project_id: projectId, name },
  });
}

export function studentProjectRequirementsUrl(projectId, { download = false } = {}) {
  const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
  const params = download ? "?download=1" : "";
  return `${API_URL}/api/student/projects/${projectId}/requirements${params}`;
}

export function openStudentProjectRequirements(projectId, { download = false } = {}) {
  window.open(
    studentProjectRequirementsUrl(projectId, { download }),
    "_blank",
    "noopener,noreferrer",
  );
}

export function updateStudentAccount({ email, currentPassword, newPassword }) {
  const payload = {
    current_password: currentPassword,
  };
  if (email !== undefined) payload.email = email;
  if (newPassword) payload.new_password = newPassword;
  return apiRequest("/api/update_info", {
    method: "PUT",
    payload,
  });
}

export function getAvailableSkills({ search = "", category = "" } = {}) {
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

export function getMyAccount() {
  return apiRequest("/api/me");
}

export function updateMyProfile(payload) {
  return apiRequest("/api/me", {
    method: "PUT",
    payload,
    errorMessage: "Unable to update your profile.",
  });
}

export function uploadStudentAvatar(file) {
  const body = new FormData();
  body.append("avatar", file);
  return apiRequest("/api/me/avatar", {
    method: "POST",
    body,
    errorMessage: "Unable to upload your profile picture.",
  });
}

export function deleteStudentAvatar() {
  return apiRequest("/api/me/avatar", {
    method: "DELETE",
    errorMessage: "Unable to remove your profile picture.",
  });
}

export function avatarUrl(userId, profilePicture) {
  if (!userId || !profilePicture) return null;
  return `${API_URL}/api/users/${userId}/avatar`;
}

export function getStudents({
  search = "",
  skillId = "",
  courseId = "",
  page = 1,
  perPage = 12,
  signal,
} = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (skillId) params.set("skill_id", skillId);
  if (courseId) params.set("course_id", courseId);
  params.set("page", page);
  params.set("per_page", perPage);
  return apiRequest(`/api/students?${params.toString()}`, { signal });
}

export function getStudentPublicProfile(studentId) {
  return apiRequest(`/api/students/${studentId}`);
}

export function getPresence(ids = []) {
  const params = new URLSearchParams();
  if (ids.length) params.set("ids", ids.join(","));
  const query = params.toString();
  return apiRequest(`/api/presence/students${query ? `?${query}` : ""}`);
}

export function pingPresence(connectionId) {
  return apiRequest("/api/presence/ping", {
    method: "POST",
    payload: { connection_id: connectionId },
  });
}

export function presenceStreamUrl() {
  return `${API_URL}/api/presence/stream`;
}

export function getMyPeerFeedback(projectId) {
  const params = new URLSearchParams();
  if (projectId !== null && projectId !== undefined) {
    params.set("project_id", projectId);
  }
  const query = params.toString();
  return apiRequest(`/api/student/peer-feedback${query ? `?${query}` : ""}`, {
    errorMessage: "Unable to load your peer feedback.",
  });
}

export function savePeerFeedback({ projectId, toStudentId, rating, feedback }) {
  return apiRequest("/api/student/peer-feedback", {
    method: "POST",
    payload: {
      project_id: projectId,
      to_student_id: toStudentId,
      rating,
      feedback,
    },
    errorMessage: "Unable to save peer feedback.",
  });
}

export function getTeamSubmission(teamId) {
  return apiRequest(`/api/student/teams/${teamId}/submission`, {
    errorMessage: "Unable to load the team submission.",
  });
}

export function submitTeamProject(teamId, file, onProgress, signal) {
  return uploadWithProgress(
    `/api/student/teams/${teamId}/submission`,
    file,
    { field: "file", onProgress, signal },
  );
}

export function teamSubmissionFileUrl(teamId, download = false) {
  const params = download ? "?download=1" : "";
  return `${API_URL}/api/student/teams/${teamId}/submission/file${params}`;
}

export function fetchTeamSubmissionFile(teamId, download = false) {
  return fetchInstructorFile(
    teamSubmissionFileUrl(teamId, download),
    "Unable to open the submitted file.",
  );
}

export function getTeamChats() {
  return apiRequest("/api/student/chats", {
    errorMessage: "Unable to load your team chats.",
  });
}

export function getTeamMessages(teamId, { before = null, limit = 200 } = {}) {
  const params = new URLSearchParams();
  if (before !== null && before !== undefined) params.set("before", before);
  if (limit) params.set("limit", limit);
  const query = params.toString();
  return apiRequest(`/api/student/teams/${teamId}/messages${query ? `?${query}` : ""}`, {
    errorMessage: "Unable to load this conversation.",
  });
}

export function sendTeamMessage(teamId, content) {
  return apiRequest(`/api/student/teams/${teamId}/messages`, {
    method: "POST",
    payload: { content },
    errorMessage: "Unable to send this message.",
  });
}

export function getFriendOverview() {
  return apiRequest("/api/student/friends", {
    errorMessage: "Unable to load your friends.",
  });
}

export function searchFriends(search = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const query = params.toString();
  return apiRequest(`/api/student/friends/search${query ? `?${query}` : ""}`, {
    errorMessage: "Unable to search students.",
  });
}

export function sendFriendRequest(recipientId) {
  return apiRequest("/api/student/friends/requests", {
    method: "POST",
    payload: { recipient_id: recipientId },
    errorMessage: "Unable to send this friend request.",
  });
}

export function acceptFriendRequest(requestId) {
  return apiRequest(`/api/student/friends/requests/${requestId}/accept`, {
    method: "POST",
    errorMessage: "Unable to accept this friend request.",
  });
}

export function rejectFriendRequest(requestId) {
  return apiRequest(`/api/student/friends/requests/${requestId}/reject`, {
    method: "POST",
    errorMessage: "Unable to reject this friend request.",
  });
}

export function removeFriend(friendId) {
  return apiRequest(`/api/student/friends/${friendId}`, {
    method: "DELETE",
    errorMessage: "Unable to remove this friend.",
  });
}
