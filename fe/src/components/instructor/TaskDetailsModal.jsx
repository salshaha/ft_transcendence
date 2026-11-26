import { useEffect, useState } from "react"
import { useTeamRealtime } from "../../hooks/useTeamRealtime"
import Modal from "./Modal"
import { formatBytes, formatDate, statusTone } from "./formatters"
import { saveFileBlob } from "../../services/instructorService"
import { removeById, upsertById } from "../../services/realtimeReducers"
import {
  createTaskComment,
  createTaskFeedback,
  deleteTask,
  deleteTaskAttachment,
  deleteTaskComment,
  fetchTaskAttachment,
  getTaskAttachments,
  getTaskComments,
  updateTask,
  uploadTaskAttachment,
} from "../../services/taskService"

export default function TaskDetailsModal({ task, onClose, onTaskUpdated, onTaskDeleted, canManage = false, viewerRole = "", currentUserId = null }) {
  const [currentTask, setCurrentTask] = useState(task)
  const [comments, setComments] = useState([])
  const [attachments, setAttachments] = useState([])
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || "")
  const [commentBody, setCommentBody] = useState("")
  const [feedbackBody, setFeedbackBody] = useState("")
  const [status, setStatus] = useState(task.status)
  const [assigneeId, setAssigneeId] = useState(String(task.assignee_id ?? ""))
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 16) : "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setCurrentTask(task)
  }, [task])

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description || "")
    setStatus(task.status)
    setAssigneeId(String(task.assignee_id ?? ""))
    setDueDate(task.due_date ? task.due_date.slice(0, 16) : "")
  }, [task.id])

  useTeamRealtime(task?.team_id ? [task.team_id] : [], (event, payload) => {
    if (payload?.task_id !== task.id) return
    if (event === "comment_created" || event === "comment_updated") {
      const comment = payload.comment
      if (!comment) return
      setComments((items) => upsertById(items, comment))
    } else if (event === "comment_deleted") {
      setComments((items) => removeById(items, payload.comment_id))
    }
  })

  useEffect(() => {
    let active = true
    Promise.all([getTaskComments(task.id), getTaskAttachments(task.id)])
      .then(([commentList, attachmentList]) => {
        if (active) {
          setComments(commentList)
          setAttachments(attachmentList)
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => {
      active = false
    }
  }, [task.id])

  async function saveTaskChanges() {
    setBusy(true)
    setError("")
    try {
      const updated = await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        assignee_id: assigneeId === "" ? null : Number(assigneeId),
        due_date: dueDate || null,
      })
      setCurrentTask(updated)
      onTaskUpdated?.(updated)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteCurrentTask() {
    if (!window.confirm("Delete this task? Its comments and attachments will also be deleted.")) return
    setBusy(true)
    setError("")
    try {
      await deleteTask(task.id)
      onTaskDeleted?.(task.id)
    } catch (requestError) {
      setError(requestError.message)
      setBusy(false)
    }
  }

  async function addComment() {
    if (!commentBody.trim()) return
    setBusy(true)
    setError("")
    try {
      const comment = await createTaskComment(task.id, commentBody.trim(), "comment")
      setComments((items) => [...items, comment])
      setCommentBody("")
      setCurrentTask((item) => ({ ...item, comment_count: item.comment_count + 1 }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function addFeedback() {
    if (!feedbackBody.trim()) return
    setBusy(true)
    setError("")
    try {
      const comment = await createTaskFeedback(task.id, feedbackBody.trim())
      setComments((items) => [...items, comment])
      setFeedbackBody("")
      setCurrentTask((item) => ({ ...item, comment_count: item.comment_count + 1 }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeComment(commentId) {
    setBusy(true)
    setError("")
    try {
      await deleteTaskComment(commentId)
      setComments((items) => items.filter((item) => item.id !== commentId))
      setCurrentTask((item) => ({ ...item, comment_count: Math.max(0, item.comment_count - 1) }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function addAttachment(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const attachment = await uploadTaskAttachment(task.id, file)
      setAttachments((items) => [attachment, ...items])
      setCurrentTask((item) => ({ ...item, attachment_count: item.attachment_count + 1 }))
      event.target.value = ""
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function openAttachment(attachment) {
    setError("")
    try {
      const { blob } = await fetchTaskAttachment(attachment.id)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function downloadAttachment(attachment) {
    setError("")
    try {
      const { blob } = await fetchTaskAttachment(attachment.id, true)
      saveFileBlob(blob, attachment.file.original_name)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function removeAttachment(attachmentId) {
    setBusy(true)
    setError("")
    try {
      await deleteTaskAttachment(attachmentId)
      setAttachments((items) => items.filter((item) => item.id !== attachmentId))
      setCurrentTask((item) => ({ ...item, attachment_count: Math.max(0, item.attachment_count - 1) }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const members = currentTask.team?.members || []
  const studentComments = comments.filter((comment) => comment.kind !== "instructor_feedback")
  const feedback = comments.filter((comment) => comment.kind === "instructor_feedback")
  const canModifyComment = (comment) => comment.author_id === currentUserId
  const canModifyAttachment = (attachment) => attachment.uploader_id === currentUserId

  return (
    <Modal wide title={currentTask.title} onClose={onClose}>
      {error && <p className="theme-soft mb-4 rounded-xl p-3 text-sm text-[#a94646]" role="alert">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="theme-soft rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">Course</div>
          <div className="mt-1 text-sm font-semibold text-[#003C43]">{currentTask.course?.name || "—"}</div>
        </div>
        <div className="theme-soft rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">Project</div>
          <div className="mt-1 text-sm font-semibold text-[#003C43]">{currentTask.project?.title || "—"}</div>
        </div>
        <div className="theme-soft rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">Team</div>
          <div className="mt-1 text-sm font-semibold text-[#003C43]">{currentTask.team?.name || "—"}</div>
        </div>
        <div className="theme-soft rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">Assignee</div>
          <div className="mt-1 text-sm font-semibold text-[#003C43]">{currentTask.assignee?.name || "Unassigned"}</div>
        </div>
        <div className="theme-soft rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">Created by</div>
          <div className="mt-1 text-sm font-semibold text-[#003C43]">{currentTask.creator?.name || "—"}</div>
        </div>
      </div>

      <div className="theme-soft mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl p-3">
        <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${statusTone(currentTask.status)}`}>{currentTask.status.replaceAll("_", " ")}</span>
        <span className="text-xs text-[#587376]">Due {formatDate(currentTask.due_date)}</span>
      </div>

      {currentTask.description && (
        <p className="theme-soft mt-4 whitespace-pre-wrap rounded-xl border border-[#003C43]/8 p-3 text-sm leading-6 text-[#365c60]">
          {currentTask.description}
        </p>
      )}

      {canManage ? (
        <section className="theme-soft mt-6 rounded-2xl border border-[#003C43]/8 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#003C43]">Manage task</h3>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">Team task</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#365c60]">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-[#365c60]">
              Assignee
              <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2 text-sm">
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold text-[#365c60]">
            Description
            <textarea rows="3" value={description} onChange={(event) => setDescription(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2 text-sm" />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#365c60]">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2 text-sm">
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-[#365c60]">
              Due date
              <input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={deleteCurrentTask} className="mr-auto rounded-lg border border-[#a94646]/25 px-4 py-2 text-xs font-bold text-[#a94646] disabled:opacity-60">Delete task</button>
            <button type="button" disabled={busy} onClick={saveTaskChanges} className="rounded-lg bg-[#6D5BD0] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </section>
      ) : (
        <section className="theme-soft mt-6 rounded-2xl border border-[#003C43]/8 p-4">
          <h3 className="text-sm font-bold text-[#003C43]">Task details</h3>
          <p className="mt-2 text-xs leading-6 text-[#587376]">Instructors have read-only access to team tasks. Use the feedback section below to give guidance.</p>
        </section>
      )}

      <section className="mt-6">
        <h3 className="text-sm font-bold text-[#003C43]">Instructor feedback ({feedback.length})</h3>
        <div className="mt-3 space-y-2">
          {feedback.map((item) => (
            <article key={item.id} className="theme-soft rounded-xl border border-[#003C43]/8 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#003C43]">{item.author?.name || "Deleted user"} <span className="ml-1 text-[10px] uppercase tracking-wide text-[#77B0AA]">{item.author_role || "instructor"}</span></div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#718b8d]">{formatDate(item.created_at)}</span>
                  {canModifyComment(item) && <button type="button" disabled={busy} onClick={() => removeComment(item.id)} className="text-[10px] font-semibold text-[#a94646] hover:underline disabled:opacity-50">Delete</button>}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#365c60]">{item.body}</p>
            </article>
          ))}
          {feedback.length === 0 && <p className="theme-soft rounded-xl p-3 text-xs text-[#718b8d]">No instructor feedback yet.</p>}
        </div>
        {viewerRole === "instructor" && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea
              value={feedbackBody}
              onChange={(event) => setFeedbackBody(event.target.value)}
              placeholder="Write instructor feedback…"
              rows="2"
              className="theme-control w-full rounded-lg border p-2.5 text-sm"
            />
            <button type="button" disabled={busy || !feedbackBody.trim()} onClick={addFeedback} className="shrink-0 rounded-lg bg-[#135D66] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              Submit feedback
            </button>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-bold text-[#003C43]">Comments ({studentComments.length})</h3>
        <div className="mt-3 space-y-2">
          {studentComments.map((comment) => (
            <article key={comment.id} className="theme-soft rounded-xl border border-[#003C43]/8 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#003C43]">{comment.author?.name || "Deleted user"}</div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#718b8d]">{formatDate(comment.created_at)}</span>
                  {canModifyComment(comment) && <button type="button" disabled={busy} onClick={() => removeComment(comment.id)} className="text-[10px] font-semibold text-[#a94646] hover:underline disabled:opacity-50">Delete</button>}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#365c60]">{comment.body}</p>
            </article>
          ))}
          {studentComments.length === 0 && <p className="theme-soft rounded-xl p-3 text-xs text-[#718b8d]">No comments yet.</p>}
        </div>
        {viewerRole === "student" && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Write a comment…"
              rows="2"
              className="theme-control w-full rounded-lg border p-2.5 text-sm"
            />
            <button type="button" disabled={busy || !commentBody.trim()} onClick={addComment} className="shrink-0 rounded-lg bg-[#6D5BD0] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              Add comment
            </button>
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#003C43]">Attachments ({attachments.length})</h3>
          {viewerRole === "student" && (
            <label className="theme-control cursor-pointer rounded-lg border px-3 py-2 text-xs font-bold text-[#135D66] transition hover:bg-[#E3FEF7]">
              Upload file
              <input type="file" className="hidden" onChange={addAttachment} />
            </label>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <article key={attachment.id} className="theme-soft flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#003C43]/8 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[#003C43]">{attachment.file.original_name}</div>
                <div className="text-[10px] text-[#718b8d]">{formatBytes(attachment.file.size)} · {attachment.uploader?.name || "Deleted user"} · {formatDate(attachment.created_at)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => openAttachment(attachment)} className="theme-control rounded-md px-2.5 py-1.5 text-[10px] font-bold text-[#135D66]">View</button>
                <button type="button" onClick={() => downloadAttachment(attachment)} className="theme-control rounded-md px-2.5 py-1.5 text-[10px] font-bold text-[#135D66]">Download</button>
                {canModifyAttachment(attachment) && <button type="button" disabled={busy} onClick={() => removeAttachment(attachment.id)} className="rounded-md px-2.5 py-1.5 text-[10px] font-bold text-[#a94646] disabled:opacity-50">Delete</button>}
              </div>
            </article>
          ))}
          {attachments.length === 0 && <p className="theme-soft rounded-xl p-3 text-xs text-[#718b8d]">No attachments yet.</p>}
        </div>
      </section>
    </Modal>
  )
}
