import { useEffect, useState } from "react"
import {
  saveInstructorGrade,
  setInstructorGradePublished,
} from "../../services/instructorService"

export default function SubmissionGradeEditor({
  submission,
  students = [],
  grade = null,
  maxGrade = 100,
  onSaved,
}) {
  const fallbackStudents = submission.submitted_by
    ? [
        {
          id: submission.submitted_by,
          full_name: submission.submitter_name || "Submitter",
        },
      ]
    : []
  const options = students.length ? students : fallbackStudents
  const [studentId, setStudentId] = useState("")
  const [value, setValue] = useState("")
  const [feedback, setFeedback] = useState("")
  const [published, setPublished] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    const initialStudent =
      grade?.student_id ??
      submission.submitted_by ??
      (students.length ? students[0].id : "")
    setStudentId(String(initialStudent ?? ""))
    setValue(
      grade?.grade === null || grade?.grade === undefined
        ? ""
        : String(grade.grade),
    )
    setFeedback(grade?.feedback || "")
    setPublished(Boolean(grade?.published))
    setNotice("")
    setError("")
  }, [
    submission.id,
    submission.submitted_by,
    submission.submitter_name,
    grade?.id,
    grade?.updated_at,
    students,
  ])

  async function saveGrade(event) {
    event.preventDefault()
    const numericGrade = Number(value)
    if (!studentId) {
      setError("Select a student to grade.")
      return
    }
    if (value === "" || !Number.isFinite(numericGrade)) {
      setError("Enter a numeric grade.")
      return
    }
    if (numericGrade < 0 || numericGrade > maxGrade) {
      setError(`Grade must be between 0 and ${maxGrade}.`)
      return
    }
    if (
      published &&
      !grade?.published &&
      !window.confirm("Publish this grade to the student now?")
    ) {
      return
    }
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await saveInstructorGrade(
        {
          student_id: Number(studentId),
          project_id: submission.project_id,
          team_id: submission.team_id,
          grade: numericGrade,
          feedback: feedback.trim() || null,
          published,
        },
        grade?.id,
      )
      setNotice(published ? "Grade saved and published." : "Grade saved as unpublished.")
      await onSaved?.()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function togglePublish() {
    if (!grade) return
    const nextPublished = !grade.published
    if (
      !window.confirm(
        `${nextPublished ? "Publish" : "Unpublish"} this grade for ${grade.student_name || "this student"}?`,
      )
    ) {
      return
    }
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await setInstructorGradePublished(grade.id, nextPublished)
      setNotice(nextPublished ? "Grade published." : "Grade unpublished.")
      await onSaved?.()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-[#003C43]/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-[#003C43]">Grade this submission</h4>
        {grade && (
          <span className="text-[10px] font-bold uppercase text-[#77B0AA]">
            {grade.published ? "Published" : "Unpublished"}
          </span>
        )}
      </div>
      <form onSubmit={saveGrade} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#365c60]">
          Student
          <select
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            disabled={Boolean(grade)}
            className="theme-control mt-1 w-full rounded-lg border p-2 text-sm disabled:opacity-60"
          >
            {options.length === 0 && <option value="">No enrolled student</option>}
            {options.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#365c60]">
          Grade (0–{maxGrade})
          <input
            type="number"
            step="0.01"
            min="0"
            max={maxGrade}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="theme-control mt-1 w-full rounded-lg border p-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-[#365c60] sm:col-span-2">
          Feedback
          <textarea
            rows="2"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Written feedback for this student."
            className="theme-control mt-1 w-full rounded-lg border p-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#365c60]">
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Publish now
          </label>
          <button
            type="submit"
            disabled={busy || options.length === 0}
            className="rounded-lg bg-[#135D66] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : grade ? "Save changes" : "Record grade"}
          </button>
          {grade && (
            <button
              type="button"
              disabled={busy}
              onClick={togglePublish}
              className="rounded-lg border border-[#135D66]/20 px-3 py-2 text-xs font-bold text-[#135D66] disabled:opacity-60"
            >
              {grade.published ? "Unpublish" : "Publish"}
            </button>
          )}
        </div>
      </form>
      {error && <p className="mt-3 text-xs text-[#a94646]" role="alert">{error}</p>}
      {notice && <p className="mt-3 text-xs text-[#135D66]" role="status">{notice}</p>}
    </section>
  )
}
