import { useEffect, useState } from "react"
import Modal from "./Modal"
import { getInstructorProjectTeams } from "../../services/instructorService"
import { createTask } from "../../services/taskService"

export default function TaskCreateModal({ projects, onClose, onCreated }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ? String(projects[0].id) : "")
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [status, setStatus] = useState("todo")
  const [dueDate, setDueDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    setTeamId("")
    setAssigneeId("")
    setTeams([])
    if (!projectId) return undefined
    getInstructorProjectTeams(projectId)
      .then((response) => {
        if (active) setTeams(response.teams || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => {
      active = false
    }
  }, [projectId])

  const selectedTeam = teams.find((team) => String(team.id) === String(teamId))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const task = await createTask({
        team_id: Number(teamId),
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId === "" ? null : Number(assigneeId),
        status,
        due_date: dueDate || null,
      })
      onCreated?.(task)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Assign a new task" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl bg-[#fdece6] p-3 text-sm text-[#a94646]" role="alert">{error}</p>}
        <label className="block text-xs font-semibold text-[#365c60]">
          Project
          <select required value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm">
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.title || `Project ${project.id}`} · {project.course?.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-[#365c60]">
          Team
          <select required value={teamId} onChange={(event) => { setTeamId(event.target.value); setAssigneeId("") }} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm">
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name} · {team.member_count} members</option>
            ))}
          </select>
        </label>
        {projectId && teams.length === 0 && (
          <p className="rounded-xl bg-[#f0f7f6] p-3 text-xs text-[#718b8d]">No teams have joined this project yet.</p>
        )}
        <label className="block text-xs font-semibold text-[#365c60]">
          Task title
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-[#365c60]">
          Description
          <textarea rows="3" value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-[#365c60]">
            Assignee
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm" disabled={!selectedTeam}>
              <option value="">Unassigned</option>
              {selectedTeam?.members.map((member) => (
                <option key={member.student_id} value={member.student_id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#365c60]">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm">
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[#365c60]">
            Due date
            <input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#003C43]/15 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={busy || !projectId || !teamId || !title.trim()} className="rounded-lg bg-[#135D66] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy ? "Assigning…" : "Assign task"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
