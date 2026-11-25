import { useState } from "react"
import Modal from "../instructor/Modal"
import { createTask } from "../../services/taskService"

export default function StudentTaskCreateModal({ teams, onClose, onCreated }) {
  const [teamId, setTeamId] = useState(teams[0]?.id ? String(teams[0].id) : "")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [status, setStatus] = useState("todo")
  const [dueDate, setDueDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

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
    <Modal title="Create a team task" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="theme-soft rounded-xl p-3 text-sm text-[#a94646]" role="alert">{error}</p>}
        <label className="block text-xs font-semibold text-[#365c60]">
          Team
          <select required value={teamId} onChange={(event) => { setTeamId(event.target.value); setAssigneeId("") }} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm">
            <option value="">Select your team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name} · {team.project?.course?.name || "Project"}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-[#365c60]">
          Task title
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-[#365c60]">
          Description
          <textarea rows="3" value={description} onChange={(event) => setDescription(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-[#365c60]">
            Assignee
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm" disabled={!selectedTeam}>
              <option value="">Unassigned</option>
              {selectedTeam?.members.map((member) => (
                <option key={member.student_id} value={member.student_id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#365c60]">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm">
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[#365c60]">
            Due date
            <input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="theme-control rounded-lg px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={busy || !teamId || !title.trim()} className="rounded-lg bg-[#6D5BD0] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
