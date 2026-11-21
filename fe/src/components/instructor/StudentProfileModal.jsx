import { useEffect, useState } from "react"
import Modal from "./Modal"
import { formatDate, statusTone } from "./formatters"
import { getInstructorStudentProfile } from "../../services/instructorService"

function Field({ label, value }) {
  return (
    <div className="rounded-xl bg-[#f0f7f6] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77B0AA]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#003C43]">{value || "—"}</div>
    </div>
  )
}

function Section({ title, children, empty }) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-bold text-[#003C43]">{title}</h3>
      {empty ? (
        <p className="mt-2 rounded-xl bg-[#f7fbfa] p-3 text-xs text-[#718b8d]">{empty}</p>
      ) : (
        <div className="mt-2 space-y-2">{children}</div>
      )}
    </section>
  )
}

export default function StudentProfileModal({ studentId, onClose }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    getInstructorStudentProfile(studentId)
      .then((response) => {
        if (active) setProfile(response.student)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => {
      active = false
    }
  }, [studentId])

  return (
    <Modal wide title="Student profile" onClose={onClose}>
      {error ? (
        <p className="rounded-xl bg-[#fdece6] p-4 text-sm text-[#a94646]" role="alert">{error}</p>
      ) : !profile ? (
        <p className="grid h-40 place-items-center text-sm text-[#718b8d]" role="status">Loading profile…</p>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-[#f0f7f6] p-4">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-[#135D66] text-lg font-bold text-white">
              {`${profile.first_name[0]}${profile.last_name[0]}`}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-[#003C43]">{profile.full_name}</h3>
              <p className="text-xs text-[#587376]">{profile.email}</p>
            </div>
            <span className="rounded-full bg-[#E3FEF7] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#135D66]">
              {profile.gpa !== null && profile.gpa !== undefined ? `GPA ${profile.gpa}` : "GPA not set"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Student ID" value={profile.student_id} />
            <Field label="Major" value={profile.major} />
            <Field label="Joined year" value={profile.joined_year} />
            <Field label="Domain" value={profile.domain} />
            <Field label="Courses enrolled" value={profile.courses.length} />
            <Field label="Teams joined" value={profile.teams.length} />
          </div>

          <Section title="Skills" empty={profile.skills.length ? null : "No skills recorded yet."}>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span key={`${skill.skill_id}-${skill.name}`} className="rounded-full bg-[#E3FEF7] px-3 py-1 text-[11px] font-semibold text-[#135D66]">
                  {skill.name} · L{skill.proficiency_level}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Enrolled courses" empty={profile.courses.length ? null : "No courses enrolled."}>
            {profile.courses.map((course) => (
              <div key={course.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#003C43]/8 bg-[#f7fbfa] p-3">
                <div>
                  <div className="text-sm font-bold text-[#003C43]">{course.name}</div>
                  <div className="text-[11px] text-[#718b8d]">{course.code} · {course.semester} {course.academic_year}</div>
                </div>
                <div className="text-[11px] font-semibold text-[#587376]">
                  {(course.projects || (course.project ? [course.project] : [])).length
                    ? `Projects: ${(course.projects || [course.project]).map((project) => project.title || "Untitled").join(", ")}`
                    : "No project yet"}
                </div>
              </div>
            ))}
          </Section>

          <Section title="Teams and submissions" empty={profile.teams.length ? null : "No team memberships yet."}>
            {profile.teams.map((team) => {
              const submission = profile.submissions.find((item) => item.team_id === team.id)
              return (
                <div key={team.id} className="rounded-xl border border-[#003C43]/8 bg-[#f7fbfa] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[#003C43]">{team.name}</div>
                    <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${statusTone(team.status)}`}>{team.status.replaceAll("_", " ")}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[#718b8d]">{team.course.name} · {team.project.title || "Course project"}</div>
                  <div className="mt-2 text-[11px] font-semibold text-[#587376]">
                    {submission ? `Submitted ${formatDate(submission.submitted_at)}` : "No submission yet"}
                  </div>
                </div>
              )
            })}
          </Section>

          <Section title="Tasks" empty={profile.tasks.length ? null : "No tasks assigned or created yet."}>
            {profile.tasks.map((task) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#003C43]/8 bg-[#f7fbfa] p-3">
                <div>
                  <div className="text-sm font-bold text-[#003C43]">{task.title}</div>
                  <div className="text-[11px] text-[#718b8d]">{task.team?.name} · Due {formatDate(task.due_date)}</div>
                </div>
                <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${statusTone(task.status)}`}>{task.status.replaceAll("_", " ")}</span>
              </div>
            ))}
          </Section>

          <Section title="Grades" empty={profile.grades.length ? null : "No grades recorded yet."}>
            {profile.grades.map((grade) => (
              <div key={grade.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#003C43]/8 bg-[#f7fbfa] p-3">
                <div>
                  <div className="text-sm font-bold text-[#003C43]">{grade.project_title || "Project"}</div>
                  <div className="text-[11px] text-[#718b8d]">{grade.feedback || "No feedback"}</div>
                </div>
                <div className="text-sm font-bold text-[#135D66]">{grade.grade ?? "—"}{!grade.published && <span className="ml-2 text-[10px] font-semibold text-[#a94646]">UNPUBLISHED</span>}</div>
              </div>
            ))}
          </Section>

          <Section title="Peer feedback received" empty={profile.feedback_received.length ? null : "No peer feedback received."}>
            {profile.feedback_received.map((item) => (
              <div key={item.id} className="rounded-xl border border-[#003C43]/8 bg-[#f7fbfa] p-3">
                <div className="text-sm font-bold text-[#003C43]">{item.project_title || "Project"} · {item.rating ?? "—"}/5</div>
                <div className="mt-1 text-[11px] text-[#718b8d]">From {item.from || "Unknown"} · {formatDate(item.created_at)}</div>
                {item.feedback && <p className="mt-2 text-xs leading-5 text-[#365c60]">{item.feedback}</p>}
              </div>
            ))}
          </Section>
        </div>
      )}
    </Modal>
  )
}
