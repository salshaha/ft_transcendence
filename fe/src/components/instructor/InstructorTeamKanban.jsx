import { useState } from "react"
import { getInstructorGradeAudit, saveInstructorGrade } from "../../services/instructorService"
import { formatDate, statusTone } from "./formatters"
import Modal from "./Modal"
import StudentAvatar from "./StudentAvatar"

const COLUMNS = [
  { key: "todo", label: "To Do", hint: "Pending tasks" },
  { key: "in_progress", label: "In Progress", hint: "Currently active" },
  { key: "review", label: "In Review", hint: "Awaiting review" },
  { key: "done", label: "Done", hint: "Completed tasks" },
]

const STATS = [
  { key: "total", label: "Total tasks" },
  { key: "todo", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "Awaiting review" },
  { key: "done", label: "Completed" },
  { key: "overdue", label: "Overdue" },
]

function TaskCard({ task, onOpenTask }) {
  return (
    <button
      type="button"
      onClick={() => onOpenTask(task)}
      className="theme-soft w-full rounded-xl border border-[#003C43]/10 p-3 text-left transition hover:border-[#77B0AA]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 text-sm font-bold text-[#003C43]">{task.title}</h4>
        {task.is_overdue && (
          <span className="shrink-0 rounded-md bg-[#fdece6] px-2 py-0.5 text-[9px] font-bold uppercase text-[#a94646]">
            Overdue
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#587376]">
        {task.description || "No description provided."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${statusTone(task.status)}`}>
          {task.status.replaceAll("_", " ")}
        </span>
        <span className="text-[11px] font-semibold text-[#365c60]">
          {task.assignee?.name || "Unassigned"}
        </span>
      </div>
      <div className="mt-3 space-y-1 border-t border-[#003C43]/8 pt-3 text-[10px] text-[#718b8d]">
        <p>Due: {formatDate(task.due_date)}</p>
        <p>Created: {formatDate(task.created_at)}</p>
        <p>Updated: {formatDate(task.updated_at)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-[#135D66]">
        <span className="rounded-md bg-white px-2 py-1">{task.comment_count || 0} comments</span>
        <span className="rounded-md bg-white px-2 py-1">{task.attachment_count || 0} attachments</span>
      </div>
    </button>
  )
}

export default function InstructorTeamKanban({
  board,
  onOpenTask,
  onRefresh,
  refreshing = false,
}) {
  const [gradeEditor, setGradeEditor] = useState(null)
  const [gradeSaving, setGradeSaving] = useState(false)
  const [gradeError, setGradeError] = useState("")
  const [gradeNotice, setGradeNotice] = useState("")
  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const counts = board.task_counts || {}
  const members = board.team?.members || []
  const grades = board.grades || []
  const maxGrade = board.project?.max_grade ?? 100

  function gradeFor(memberId) {
    return grades.find((grade) => grade.student_id === memberId) || null
  }

  function openGradeEditor(member) {
    const grade = gradeFor(member.id)
    setGradeError("")
    setGradeNotice("")
    setGradeEditor({
      gradeId: grade?.id ?? null,
      member,
      grade: grade?.grade === null || grade?.grade === undefined ? "" : String(grade.grade),
      feedback: grade?.feedback || "",
      published: false,
    })
  }

  async function saveGrade(event) {
    event.preventDefault()
    if (!gradeEditor) return
    const numericGrade = Number(gradeEditor.grade)
    if (gradeEditor.grade === "" || !Number.isFinite(numericGrade)) {
      setGradeError("Enter a numeric grade.")
      return
    }
    if (numericGrade < 0 || numericGrade > maxGrade) {
      setGradeError(`Grade must be between 0 and ${maxGrade}.`)
      return
    }
    if (
      gradeEditor.published &&
      !window.confirm(
        `Publish this grade for ${gradeEditor.member.full_name}? Published grades are visible to the student.`,
      )
    ) {
      return
    }

    setGradeSaving(true)
    setGradeError("")
    try {
      await saveInstructorGrade(
        {
          student_id: gradeEditor.member.id,
          project_id: board.project.id,
          team_id: board.team.id,
          grade: numericGrade,
          feedback: gradeEditor.feedback.trim() || null,
          published: gradeEditor.published,
        },
        gradeEditor.gradeId,
      )
      setGradeEditor(null)
      setGradeNotice("Grade saved.")
      if (onRefresh) await onRefresh()
    } catch (requestError) {
      setGradeError(requestError.message)
    } finally {
      setGradeSaving(false)
    }
  }

  async function openHistory(gradeId) {
    setHistoryLoading(true)
    setGradeError("")
    try {
      setHistory(await getInstructorGradeAudit(gradeId))
    } catch (requestError) {
      setGradeError(requestError.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77B0AA]">
              {board.project?.course?.name || "Project"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#003C43]">
              {board.project?.title || "Project"} · {board.team?.name || "Team"}
            </h1>
            <p className="mt-2 text-xs text-[#6d898b]">
              Tasks are read-only. Record an individual grade and written feedback for each team member.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="theme-soft rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#135D66]">
              View only
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="theme-control rounded-xl border px-4 py-2 text-xs font-bold text-[#135D66] disabled:opacity-60"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        {members.length > 0 && (
          <div className="mt-5 grid gap-3 border-t border-[#003C43]/8 pt-4 md:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => {
              const grade = gradeFor(member.id)
              return (
                <div key={member.id} className="theme-soft flex items-center gap-3 rounded-xl p-3">
                  <StudentAvatar student={member} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-[#003C43]">{member.full_name}</div>
                    <div className="text-[10px] text-[#718b8d]">
                      {member.is_leader ? "Team leader" : "Member"}
                      {grade && ` · ${grade.grade ?? "—"}/${maxGrade}`}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => openGradeEditor(member)}
                      className="rounded-lg bg-[#135D66] px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#003C43]"
                    >
                      {grade ? "Edit grade" : "Record grade"}
                    </button>
                    {grade?.id && (
                      <button
                        type="button"
                        onClick={() => openHistory(grade.id)}
                        className="text-[10px] font-bold text-[#135D66] underline"
                      >
                        History
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {gradeNotice && (
          <p className="mt-3 rounded-lg bg-[#E3FEF7] px-3 py-2 text-xs font-semibold text-[#135D66]" role="status">
            {gradeNotice}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {STATS.map((stat) => (
          <article
            key={stat.key}
            className="theme-surface rounded-xl border border-[#003C43]/8 bg-white p-4"
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#718b8d]">
              {stat.label}
            </div>
            <div className={`mt-1 text-xl font-extrabold ${stat.key === "overdue" ? "text-[#a94646]" : "text-[#003C43]"}`}>
              {counts[stat.key] ?? 0}
            </div>
          </article>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnTasks = board.tasks_by_status?.[column.key] || []
          return (
            <section
              key={column.key}
              className="theme-surface min-w-[280px] flex-1 rounded-2xl border border-[#003C43]/8 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#003C43]">{column.label}</h2>
                  <p className="mt-0.5 text-[10px] text-[#718b8d]">{column.hint}</p>
                </div>
                <span className="theme-soft grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-extrabold text-[#135D66]">
                  {columnTasks.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onOpenTask={onOpenTask} />
                ))}
                {columnTasks.length === 0 && (
                  <p className="theme-soft rounded-xl p-4 text-center text-xs text-[#718b8d]">
                    No tasks in this stage.
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {gradeEditor && (
        <Modal
          title={`${gradeEditor.gradeId ? "Edit" : "Record"} grade · ${gradeEditor.member.full_name}`}
          onClose={() => setGradeEditor(null)}
        >
          <form onSubmit={saveGrade} className="space-y-4">
            <p className="text-xs text-[#587376]">
              {board.project?.title || "Project"} · {board.team?.name || "Team"} · maximum grade {maxGrade}
            </p>
            <label className="block text-xs font-semibold text-[#365c60]">
              Grade (0–{maxGrade})
              <input
                type="number"
                step="0.01"
                min="0"
                max={maxGrade}
                required
                value={gradeEditor.grade}
                onChange={(event) => setGradeEditor({ ...gradeEditor, grade: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-[#365c60]">
              Written feedback
              <textarea
                rows="4"
                value={gradeEditor.feedback}
                onChange={(event) => setGradeEditor({ ...gradeEditor, feedback: event.target.value })}
                placeholder="Explain the result and next steps for this student."
                className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm"
              />
            </label>
            {gradeEditor.gradeId && (
              <p className="rounded-lg bg-[#fff4d6] px-3 py-2 text-xs text-[#8a6210]">
                Editing unpublishes the grade until you publish this version.
              </p>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-[#365c60]">
              <input
                type="checkbox"
                checked={gradeEditor.published}
                onChange={(event) => setGradeEditor({ ...gradeEditor, published: event.target.checked })}
              />
              Publish now
            </label>
            {gradeError && (
              <p className="rounded-lg bg-[#fff0f0] px-3 py-2 text-xs text-[#a94646]" role="alert">
                {gradeError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGradeEditor(null)}
                className="rounded-lg border border-[#003C43]/15 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={gradeSaving}
                className="rounded-lg bg-[#135D66] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {gradeSaving ? "Saving…" : "Save grade"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {historyLoading && <p className="text-xs text-[#6d898b]" role="status">Loading grade history…</p>}
      {history && (
        <Modal title="Grade history" onClose={() => setHistory(null)} wide>
          <div className="space-y-3">
            <p className="text-xs text-[#587376]">
              {history.grade?.student_name} · {history.grade?.project_title}
            </p>
            {history.audits.length === 0 && (
              <p className="text-xs text-[#718b8d]">No changes recorded yet.</p>
            )}
            {history.audits.map((audit) => (
              <div key={audit.id} className="rounded-xl border border-[#003C43]/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#003C43]">
                    {audit.changed_by_name || "Unknown instructor"}
                  </p>
                  <p className="text-[10px] text-[#718b8d]">{formatDate(audit.changed_at)}</p>
                </div>
                <p className="mt-2 text-xs text-[#365c60]">
                  Grade: {audit.old_grade ?? "—"} → {audit.new_grade ?? "—"}
                </p>
                {audit.old_feedback !== audit.new_feedback && (
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    <p className="rounded-lg bg-[#f0f7f6] p-2 text-[#587376]">
                      Before: {audit.old_feedback || "No feedback"}
                    </p>
                    <p className="rounded-lg bg-[#dff8f3] p-2 text-[#135D66]">
                      After: {audit.new_feedback || "No feedback"}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}
