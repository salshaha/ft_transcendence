import { useEffect, useState } from "react"
import PasswordSecurityCard from "../components/auth/PasswordSecurityCard"
import { formatDate, statusTone } from "../components/instructor/formatters"
import TaskDetailsModal from "../components/instructor/TaskDetailsModal"
import StudentTaskCreateModal from "../components/student/StudentTaskCreateModal"
import { listTasks } from "../services/taskService"
import {
  addStudentSkill,
  createStudentTeam,
  getAvailableSkills,
  getStudentCourseTeams,
  getStudentCourses,
  getStudentDashboard,
  getStudentProfile,
  getStudentTeams,
  joinStudentTeam,
  openStudentProjectRequirements,
  removeStudentSkill,
  updateStudentAccount,
  updateStudentSkill,
} from "../services/studentService"

const iconPaths = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  spark: (
    <path d="m12 3 1.3 4.2A5 5 0 0 0 16.8 10L21 11.5l-4.2 1.3a5 5 0 0 0-3.5 3.5L12 21l-1.3-4.7a5 5 0 0 0-3.5-3.5L3 11.5 7.2 10a5 5 0 0 0 3.5-2.8Z" />
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </>
  ),
  moon: <path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4" />
    </>
  ),
}

function Icon({
  name,
  className = "h-5 w-5",
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  )
}

const navItems = [
  { label: "Overview", icon: "grid" },
  { label: "My Profile", icon: "user" },
  { label: "My Courses", icon: "book" },
  { label: "Tasks", icon: "clipboard" },
  { label: "Settings", icon: "settings" },
]

function Sidebar({
  active,
  onSelect,
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
  student,
  onLogout,
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#003C43]/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#003C43] py-6 text-white transition-all duration-300 lg:translate-x-0 ${
          collapsed ? "lg:w-[88px] lg:px-4" : "lg:w-[272px] lg:px-5"
        } px-5 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`flex items-center px-2 ${
            collapsed ? "lg:justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="theme-invert grid h-10 w-10 place-items-center rounded-xl bg-[#E3FEF7] text-[#003C43]">
              <Icon name="spark" />
            </div>
            <div className={collapsed ? "lg:hidden" : ""}>
              <div className="text-[17px] font-bold tracking-tight">Team-Platform</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#77B0AA]">
                Learning hub
              </div>
            </div>
          </div>
          <button
            className="rounded-lg p-2 text-[#E3FEF7] lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        <button
          className="absolute -right-3 top-24 hidden h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#135D66] text-[#E3FEF7] shadow-lg transition hover:bg-[#77B0AA] hover:text-[#003C43] lg:grid"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon
            name="chevron"
            className={`h-3.5 w-3.5 transition-transform ${
              collapsed ? "" : "rotate-180"
            }`}
          />
        </button>

        <nav className="mt-10 flex-1 space-y-1.5">
          <div
            className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#77B0AA] ${
              collapsed ? "lg:text-center lg:text-[0px]" : ""
            }`}
          >
            Workspace
            {collapsed && <span className="hidden text-sm lg:inline">•••</span>}
          </div>
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onSelect(item.label)
                onClose()
              }}
              title={collapsed ? item.label : undefined}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                collapsed ? "lg:justify-center" : ""
              } ${
                active === item.label
                  ? "bg-[#6D5BD0] text-white shadow-lg shadow-black/15"
                  : "text-white/70 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon name={item.icon} className="h-[19px] w-[19px]" />
              <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div
          className={`rounded-2xl border border-white/10 bg-white/[0.06] p-3 ${
            collapsed ? "lg:p-1.5" : ""
          }`}
        >
          <div
            className={`flex items-center gap-3 ${
              collapsed ? "lg:justify-center" : ""
            }`}
          >
            <div className="theme-invert grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#77B0AA] text-xs font-bold text-[#003C43]">
              {`${(student.first_name || "?")[0]}${(student.last_name || "?")[0]}`}
            </div>
            <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <div className="truncate text-sm font-semibold">{student.full_name}</div>
              <div className="truncate text-[11px] text-white/50">
                {student.email}
              </div>
            </div>
            <button
              className={`rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white ${
                collapsed ? "lg:hidden" : ""
              }`}
              aria-label="Sign out"
              onClick={onLogout}
            >
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function CourseCard({ course, onOpen }) {
  return (
    <article className="theme-surface group flex min-w-[270px] flex-1 flex-col rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.05)] transition hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(0,60,67,0.10)]">
      <div className="flex items-start justify-between">
        <div
          className="theme-icon grid h-11 w-11 place-items-center rounded-xl bg-[#E3FEF7] text-sm font-extrabold text-[#003C43]"
        >
          {(course.name || "CO").slice(0, 2).toUpperCase()}
        </div>
        <button
          onClick={onOpen}
          className="grid h-8 w-8 place-items-center rounded-lg text-[#77B0AA] transition group-hover:bg-[#E3FEF7] group-hover:text-[#003C43]"
          aria-label={`Open ${course.name}`}
        >
          <Icon name="arrow" className="h-4 w-4" />
        </button>
      </div>
      <h3 className="mt-5 min-h-12 text-[17px] font-bold leading-6 text-[#003C43]">
        {course.name}
      </h3>
      <div className="mt-2 flex items-center gap-2 text-xs text-[#587376]">
        <Icon name="user" className="h-3.5 w-3.5" />
        {course.instructor?.name || "Instructor"}
      </div>
    </article>
  )
}

function PageHeading({
  eyebrow,
  title,
  description,
}) {
  return (
    <div className="mb-7">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6D5BD0]">
        {eyebrow}
      </div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#003C43] sm:text-[30px]">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6d898b]">
        {description}
      </p>
    </div>
  )
}

function ProfilePage({ profile, onRefreshProfile }) {
  const [skillName, setSkillName] = useState("")
  const [skillCategory, setSkillCategory] = useState("technical")
  const [proficiency, setProficiency] = useState(3)
  const [skillMessage, setSkillMessage] = useState("")
  const [skillError, setSkillError] = useState("")
  const [savingSkill, setSavingSkill] = useState(false)
  const [removingSkillId, setRemovingSkillId] = useState(null)

  const skills = Array.isArray(profile.skills) ? profile.skills : []

  async function handleAddSkill(event) {
    event.preventDefault()
    setSkillMessage("")
    setSkillError("")
    if (!skillName.trim()) {
      setSkillError("Enter a skill name.")
      return
    }
    setSavingSkill(true)
    try {
      await addStudentSkill({
        name: skillName.trim(),
        category: skillCategory,
        proficiencyLevel: proficiency,
      })
      setSkillName("")
      setSkillMessage("Skill added.")
      if (onRefreshProfile) await onRefreshProfile()
    } catch (requestError) {
      setSkillError(requestError.message)
    } finally {
      setSavingSkill(false)
    }
  }

  async function handleRemoveSkill(skillId) {
    setRemovingSkillId(skillId)
    setSkillMessage("")
    setSkillError("")
    try {
      await removeStudentSkill(skillId)
      setSkillMessage("Skill removed.")
      if (onRefreshProfile) await onRefreshProfile()
    } catch (requestError) {
      setSkillError(requestError.message)
    } finally {
      setRemovingSkillId(null)
    }
  }
  return (
    <div>
      <PageHeading
        eyebrow="Student profile"
        title="My Profile"
        description="Keep your academic identity and project skills up to date."
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)]">
          <div className="flex flex-col items-center text-center">
            <div className="theme-invert grid h-24 w-24 place-items-center rounded-[24px] bg-[#77B0AA] text-2xl font-extrabold text-[#003C43]">
              {`${profile.first_name[0]}${profile.last_name[0]}`}
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-[#003C43]">
              {profile.full_name}
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#6d898b]">
              {profile.major || "Major not provided"}
            </p>
            <span className="mt-3 rounded-full bg-[#E3FEF7] px-3 py-1.5 text-[10px] font-bold text-[#135D66]">
              {profile.gpa === null || profile.gpa === undefined
                ? "GPA not available"
                : `GPA ${Number(profile.gpa).toFixed(2)}`}
            </span>
          </div>
          <div className="mt-6 space-y-4 border-t border-[#003C43]/8 pt-6">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">
                Student ID
              </div>
              <div className="mt-1 text-xs font-bold text-[#18484d]">
                {profile.student_id || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">
                Academic department
              </div>
              <div className="mt-1 text-xs font-bold text-[#18484d]">
                {profile.domain || "Department not provided"}
              </div>
            </div>
          </div>
        </section>

        <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#003C43]">Skills</h2>
              <p className="mt-1 text-xs text-[#6d898b]">
                Help classmates find you for the right projects.
              </p>
            </div>
            <div />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.length === 0 && (
              <p className="text-xs text-[#6d898b]">No skills added yet.</p>
            )}
            {skills.map((skill) => (
              <span
                key={skill.skill_id}
                className="inline-flex items-center gap-2 rounded-full bg-[#E3FEF7] px-3 py-1.5 text-[10px] font-bold text-[#135D66]"
              >
                {skill.name} · {skill.proficiency_level}/5
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill.skill_id)}
                  disabled={removingSkillId === skill.skill_id}
                  className="text-[#135D66] transition hover:text-[#003C43] disabled:opacity-60"
                  aria-label={`Remove ${skill.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={handleAddSkill} className="mt-6 grid gap-3 sm:grid-cols-[1fr_120px_80px_auto]">
            <input
              value={skillName}
              onChange={(event) => setSkillName(event.target.value)}
              placeholder="Skill name"
              className="theme-control rounded-xl border border-[#003C43]/10 bg-white px-4 py-2.5 text-sm text-[#003C43] outline-none transition focus:border-[#6D5BD0] focus:ring-4 focus:ring-[#6D5BD0]/10"
            />
            <select
              value={skillCategory}
              onChange={(event) => setSkillCategory(event.target.value)}
              className="theme-control rounded-xl border border-[#003C43]/10 bg-white px-3 py-2.5 text-sm text-[#003C43] outline-none"
            >
              <option value="technical">Technical</option>
              <option value="interpersonal">Interpersonal</option>
              <option value="artistic">Artistic</option>
              <option value="linguistic">Linguistic</option>
              <option value="other">Other</option>
            </select>
            <select
              value={proficiency}
              onChange={(event) => setProficiency(Number(event.target.value))}
              className="theme-control rounded-xl border border-[#003C43]/10 bg-white px-3 py-2.5 text-sm text-[#003C43] outline-none"
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={savingSkill}
              className="rounded-xl bg-[#6D5BD0] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#5c49c5] disabled:cursor-wait disabled:opacity-60"
            >
              {savingSkill ? "Adding..." : "Add"}
            </button>
          </form>
          {skillError && (
            <div className="mt-3 rounded-xl bg-[#fff0f0] px-4 py-3 text-[11px] font-semibold text-[#a94646]">
              {skillError}
            </div>
          )}
          {skillMessage && (
            <div className="mt-3 rounded-xl bg-[#E3FEF7] px-4 py-3 text-[11px] font-semibold text-[#135D66]">
              {skillMessage}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function CoursesPage({ courses, onViewProject }) {
  return (
    <div>
      <PageHeading
        eyebrow="Enrolled courses"
        title="My Courses"
        description="Open a course to view materials, classmates, labs, and current project details."
      />
      <div className="grid gap-5 xl:grid-cols-3">
        {courses.map((course) => (
          <article
            key={course.id}
            className="theme-surface overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,60,67,0.06)] transition hover:-translate-y-1 hover:shadow-[0_14px_38px_rgba(0,60,67,0.11)]"
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div
                  className="theme-icon grid h-11 w-11 place-items-center rounded-xl bg-[#E3FEF7] text-sm font-extrabold text-[#003C43]"
                >
                  {course.name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <h2 className="mt-5 text-base font-extrabold text-[#003C43]">
                {course.name}
              </h2>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[#6d898b]">
                <Icon name="user" className="h-3.5 w-3.5" />
                {course.instructor.name}
              </div>
            </div>

            <div className="mx-5 mb-5 rounded-xl bg-[#f5f3ff] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#6D5BD0]">
                  Current project
                </span>
                <Icon name="file" className="h-4 w-4 text-[#6D5BD0]" />
              </div>
              <h3 className="mt-2 text-xs font-extrabold leading-5 text-[#31304c]">
                Open the project brief and manage your team.
              </h3>
              <button onClick={() => onViewProject(course)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#135D66] px-3 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#003C43]">
                View project details
                <Icon name="arrow" className="h-3.5 w-3.5" />
              </button>
            </div>
          </article>
        ))}
        {courses.length === 0 && (
          <p className="text-xs text-[#6d898b]">You are not enrolled in any courses yet.</p>
        )}
      </div>
    </div>
  )
}

function CourseProjectPage({
  course,
  data,
  loading,
  error,
  message,
  teamName,
  creatingTeam,
  joiningTeam,
  selectedProjectId,
  onSelectProject,
  onTeamNameChange,
  onCreateTeam,
  onJoinTeam,
  onBack,
}) {
  const project = data?.project || null
  const projects = Array.isArray(data?.projects) ? data.projects : project ? [project] : []
  const teams = Array.isArray(data?.teams) ? data.teams : []
  const alreadyInTeam = teams.some((team) => team.is_member)

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-5 flex items-center gap-1 text-xs font-bold text-[#135D66] transition hover:text-[#003C43]"
      >
        <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" />
        Back to courses
      </button>

      <PageHeading
        eyebrow={course?.name || "Course project"}
        title={project?.title || "Project details"}
        description="Review the project brief, create a team, or join one of the teams already working on it."
      />

      {loading ? (
        <p className="text-xs text-[#6d898b]" role="status">Loading project details...</p>
      ) : error ? (
        <p className="rounded-xl bg-[#fff0f0] p-4 text-xs text-[#a94646]" role="alert">{error}</p>
      ) : !project ? (
        <p className="rounded-xl bg-white p-4 text-xs text-[#6d898b]">No project has been published for this course yet.</p>
      ) : (
        <>
          {projects.length > 1 && (
            <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-6">
              <label className="text-xs font-semibold text-[#365c60]">Project
                <select value={selectedProjectId || project.id} onChange={(event) => onSelectProject(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm sm:max-w-md">
                  {projects.map((item) => <option key={item.id} value={item.id}>{item.title || `Project ${item.id}`}</option>)}
                </select>
              </label>
            </section>
          )}
          <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6D5BD0]">
                  Project brief
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#587376]">
                  {project.description || project.prd || "No description has been added for this project."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="theme-soft rounded-xl bg-[#f0f7f6] p-3">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">
                    <Icon name="clock" className="h-3 w-3" /> Deadline
                  </div>
                  <div className="mt-1 text-xs font-bold text-[#003C43]">
                    {project.deadline ? new Date(project.deadline).toLocaleString() : "Not set"}
                  </div>
                </div>
                <div className="theme-soft rounded-xl bg-[#f0f7f6] p-3">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">
                    <Icon name="users" className="h-3 w-3" /> Team size
                  </div>
                  <div className="mt-1 text-xs font-bold text-[#003C43]">
                    {project.min_members_per_team}–{project.max_members_per_team} members
                  </div>
                </div>
                <div className="theme-soft rounded-xl bg-[#f0f7f6] p-3">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">
                    <Icon name="file" className="h-3 w-3" /> Requirements
                  </div>
                  <div className="mt-1 text-xs font-bold text-[#003C43]">
                    {project.requirements ? "Available" : "Not uploaded"}
                  </div>
                </div>
              </div>
            </div>
            {project.requirements && (
              <button
                onClick={() => openStudentProjectRequirements(project.id)}
                className="mt-5 flex w-fit items-center justify-center gap-2 rounded-lg bg-[#E3FEF7] px-4 py-3 text-xs font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43]"
              >
                <Icon name="file" className="h-4 w-4" />
                View requirements PDF
              </button>
            )}
          </section>

          <section className="theme-surface mt-6 rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-6">
            <h2 className="text-lg font-bold text-[#003C43]">Create a team</h2>
            {alreadyInTeam ? (
              <p className="mt-3 rounded-xl bg-[#f0f7f6] p-4 text-xs text-[#135D66]">
                You are already in a team for this project.
              </p>
            ) : (
              <form onSubmit={onCreateTeam} className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={teamName}
                  onChange={(event) => onTeamNameChange(event.target.value)}
                  placeholder="Team name"
                  aria-label="Team name"
                  className="theme-control flex-1 rounded-xl border border-[#003C43]/10 bg-white px-4 py-2.5 text-sm text-[#003C43] outline-none transition focus:border-[#6D5BD0] focus:ring-4 focus:ring-[#6D5BD0]/10"
                />
                <button
                  type="submit"
                  disabled={creatingTeam}
                  className="rounded-xl bg-[#6D5BD0] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#5c49c5] disabled:cursor-wait disabled:opacity-60"
                >
                  {creatingTeam ? "Creating..." : "Create team"}
                </button>
              </form>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#003C43]">Teams in this course</h2>
                <p className="mt-1 text-xs text-[#6d898b]">
                  Every team created for this course project
                </p>
              </div>
              <span className="rounded-full bg-[#E3FEF7] px-2.5 py-1 text-[10px] font-bold text-[#135D66]">
                {teams.length} {teams.length === 1 ? "team" : "teams"}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <article
                  key={team.id}
                  className={`theme-surface rounded-2xl border bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] ${
                    team.is_member ? "border-[#77B0AA]" : "border-[#003C43]/8"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-extrabold text-[#003C43]">{team.name}</h3>
                      <div className="mt-1 text-[10px] text-[#6d898b]">
                        Led by {team.members.find((member) => member.id === team.leader_id)?.name || "TBA"}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-[#f5f3ff] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#6D5BD0]">
                      {team.status || "forming"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {team.members.map((member) => (
                          <span
                            key={member.id}
                            className="theme-invert grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-[#77B0AA] text-[8px] font-extrabold text-[#003C43]"
                          >
                            {member.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] font-semibold text-[#718b8d]">
                        {team.current_member_count}/{team.max_members}
                      </span>
                    </div>
                    <button
                      disabled={
                        joiningTeam === team.id ||
                        team.is_member ||
                        alreadyInTeam ||
                        team.available_spots <= 0
                      }
                      onClick={() => onJoinTeam(team.id)}
                      className="rounded-lg bg-[#E3FEF7] px-3 py-2 text-[10px] font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {joiningTeam === team.id
                        ? "Joining..."
                        : team.is_member
                          ? "Joined"
                          : alreadyInTeam
                            ? "Already in team"
                            : team.available_spots <= 0
                              ? "Full"
                              : "Join team"}
                    </button>
                  </div>
                  {team.is_member && (
                    <div className="mt-3 text-[10px] font-bold text-[#135D66]">Your team</div>
                  )}
                </article>
              ))}
              {teams.length === 0 && (
                <p className="text-xs text-[#6d898b]">
                  No teams have been created for this course yet. Be the first to create one.
                </p>
              )}
            </div>
          </section>

          {message && (
            <p className="mt-6 rounded-xl bg-[#E3FEF7] p-4 text-xs text-[#135D66]" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function TasksPage({
  tasks,
  myTeams,
  courses,
  loading,
  error,
  notice,
  courseFilter,
  projectFilter,
  statusFilter,
  onCourseFilterChange,
  onProjectFilterChange,
  onStatusFilterChange,
  onCreate,
  onOpen,
}) {
  const projectOptions = Array.from(
    new Map(
      tasks
        .filter((task) => task.project?.id)
        .map((task) => [task.project.id, task.project]),
    ).values(),
  )
  const visibleTasks = tasks.filter((task) => {
    if (courseFilter !== "all" && String(task.course?.id) !== courseFilter) return false
    if (projectFilter !== "all" && String(task.project?.id) !== projectFilter) return false
    if (statusFilter !== "all" && task.status !== statusFilter) return false
    return true
  })

  return (
    <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#003C43]">Tasks</h1>
          <p className="mt-1 text-xs text-[#6d898b]">
            Manage your team tasks, assign work, and review instructor feedback.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={myTeams.length === 0}
          className="rounded-xl bg-[#135D66] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#003C43] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Create task
        </button>
      </div>

      {notice && <p className="theme-soft mt-4 rounded-xl p-3 text-xs text-[#135D66]" role="status">{notice}</p>}
      {error && <p className="mt-4 rounded-xl bg-[#fff0f0] p-3 text-xs text-[#a94646]" role="alert">{error}</p>}
      {myTeams.length === 0 && !loading && (
        <p className="theme-soft mt-4 rounded-xl p-3 text-xs text-[#587376]">
          Join or create a project team before creating tasks.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-[#365c60]">Course
          <select value={courseFilter} onChange={(event) => { onCourseFilterChange(event.target.value); onProjectFilterChange("all") }} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm">
            <option value="all">All courses</option>
            {(courses.length ? courses : Array.from(new Map(tasks.map((task) => [task.course?.id, task.course]).filter(([id]) => id)).values())).map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#365c60]">Project
          <select value={projectFilter} onChange={(event) => onProjectFilterChange(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm">
            <option value="all">All projects</option>
            {projectOptions
              .filter((project) => courseFilter === "all" || String(project.course?.id) === courseFilter)
              .map((project) => <option key={project.id} value={project.id}>{project.title || `Project ${project.id}`}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#365c60]">Status
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="theme-control mt-1 w-full rounded-lg border p-2.5 text-sm">
            <option value="all">All statuses</option>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-[#6d898b]">Loading tasks...</p>
      ) : visibleTasks.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#003C43]/10 text-[10px] font-bold uppercase tracking-[0.12em] text-[#77B0AA]">
                <th className="py-3 pr-4">Task</th>
                <th className="py-3 pr-4">Course / project</th>
                <th className="py-3 pr-4">Assignee</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Due</th>
                <th className="py-3 pr-4">Activity</th>
                <th className="py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#003C43]/7">
              {visibleTasks.map((task) => (
                <tr key={task.id}>
                  <td className="py-3 pr-4">
                    <div className="font-bold text-[#003C43]">{task.title}</div>
                    <div className="text-[10px] text-[#718b8d]">{task.team?.name || "No team"}</div>
                  </td>
                  <td className="py-3 pr-4 text-xs text-[#587376]">
                    <div>{task.course?.name || "—"}</div>
                    <div className="text-[10px]">{task.project?.title || "—"}</div>
                  </td>
                  <td className="py-3 pr-4 text-xs text-[#587376]">{task.assignee?.name || <span className="italic text-[#718b8d]">Unassigned</span>}</td>
                  <td className="py-3 pr-4"><span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${statusTone(task.status)}`}>{task.status.replaceAll("_", " ")}</span></td>
                  <td className="py-3 pr-4 text-xs text-[#587376]">{formatDate(task.due_date)}</td>
                  <td className="py-3 pr-4 text-[10px] text-[#718b8d]">{task.comment_count || 0} comments · {task.attachment_count || 0} files</td>
                  <td className="py-3"><button type="button" onClick={() => onOpen(task)} className="theme-control rounded-lg px-3 py-2 text-[10px] font-bold text-[#135D66]">Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="theme-soft mt-5 rounded-xl p-4 text-sm text-[#587376]">No tasks match the current filters.</p>
      )}
    </section>
  )
}

function SettingsPage({ student, onSaveAccount, onRequestPasswordReset }) {
  const [email, setEmail] = useState(student.email)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    setEmail(student.email)
  }, [student.email])

  const saveDetails = async (event) => {
    event.preventDefault()
    setMessage("")
    if (!email.includes("@")) {
      setError("Enter a valid email address.")
      return
    }
    if (newPassword) {
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.")
        return
      }
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match.")
        return
      }
    }
    if (!currentPassword) {
      setError("Enter your current password to save changes.")
      return
    }
    setError("")
    setSaving(true)
    try {
      await onSaveAccount({ email, currentPassword, newPassword: newPassword || undefined })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setMessage("Your personal information has been updated.")
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Account preferences"
        title="Settings"
        description="Review your personal information and keep your account secure."
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-7">
          <div>
            <h2 className="text-lg font-extrabold text-[#003C43]">
              Personal information
            </h2>
            <p className="mt-1 text-xs text-[#6d898b]">
              Your name and student ID are managed by the university.
            </p>
          </div>
          <form onSubmit={saveDetails} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-[#587376]">
                  Full name
                </label>
                <input
                  value={student.full_name}
                  disabled
                  className="mt-2 w-full cursor-not-allowed rounded-xl bg-[#eef4f3] px-4 py-3 text-sm text-[#8aa1a3] outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#587376]">
                  Student ID
                </label>
                <input
                  value={student.student_id || "Not provided"}
                  disabled
                  className="mt-2 w-full cursor-not-allowed rounded-xl bg-[#eef4f3] px-4 py-3 text-sm text-[#8aa1a3] outline-none"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="email"
                className="text-[10px] font-bold text-[#587376]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setMessage("")
                  setError("")
                }}
                className="theme-control mt-2 w-full rounded-xl border border-[#003C43]/10 bg-white px-4 py-3 text-sm text-[#003C43] outline-none transition focus:border-[#6D5BD0] focus:ring-4 focus:ring-[#6D5BD0]/10"
              />
            </div>
            <div>
              <label
                htmlFor="new-password"
                className="text-[10px] font-bold text-[#587376]"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value)
                  setMessage("")
                  setError("")
                }}
                autoComplete="new-password"
                placeholder="Leave blank to keep your current password"
                className="theme-control mt-2 w-full rounded-xl border border-[#003C43]/10 bg-white px-4 py-3 text-sm text-[#003C43] outline-none transition focus:border-[#6D5BD0] focus:ring-4 focus:ring-[#6D5BD0]/10"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="text-[10px] font-bold text-[#587376]"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setMessage("")
                  setError("")
                }}
                autoComplete="new-password"
                placeholder="Repeat your new password"
                className="theme-control mt-2 w-full rounded-xl border border-[#003C43]/10 bg-white px-4 py-3 text-sm text-[#003C43] outline-none transition focus:border-[#6D5BD0] focus:ring-4 focus:ring-[#6D5BD0]/10"
              />
            </div>
            <div>
              <label
                htmlFor="current-password"
                className="text-[10px] font-bold text-[#587376]"
              >
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value)
                  setMessage("")
                  setError("")
                }}
                autoComplete="current-password"
                placeholder="Required to change account details"
                className="theme-control mt-2 w-full rounded-xl border border-[#003C43]/10 bg-white px-4 py-3 text-sm text-[#003C43] outline-none transition focus:border-[#6D5BD0] focus:ring-4 focus:ring-[#6D5BD0]/10"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-[#fff0f0] px-4 py-3 text-[11px] font-semibold text-[#a94646]">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl bg-[#E3FEF7] px-4 py-3 text-[11px] font-semibold text-[#135D66]">
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#6D5BD0] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#5c49c5] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving changes..." : "Save changes"}
            </button>
          </form>
        </section>

        <PasswordSecurityCard
          email={student.email}
          onRequestPasswordReset={onRequestPasswordReset}
        />
      </div>
    </div>
  )
}

export default function StudentDashboard({ onLogout, onRequestPasswordReset }) {
  const [active, setActive] = useState("Overview")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("team-platform-theme") === "dark")
  const [dashboard, setDashboard] = useState(null)
  const [profile, setProfile] = useState(null)
  const [coursePageData, setCoursePageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [joiningTeam, setJoiningTeam] = useState(null)
  const [joinMessage, setJoinMessage] = useState("")
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [projectData, setProjectData] = useState(null)
  const [projectLoading, setProjectLoading] = useState(false)
  const [projectError, setProjectError] = useState("")
  const [teamName, setTeamName] = useState("")
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [projectMessage, setProjectMessage] = useState("")
  const [tasks, setTasks] = useState([])
  const [myTeams, setMyTeams] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [tasksError, setTasksError] = useState("")
  const [taskNotice, setTaskNotice] = useState("")
  const [taskCourseFilter, setTaskCourseFilter] = useState("all")
  const [taskProjectFilter, setTaskProjectFilter] = useState("all")
  const [taskStatusFilter, setTaskStatusFilter] = useState("all")
  const [selectedTask, setSelectedTask] = useState(null)
  const [creatingTask, setCreatingTask] = useState(false)

  useEffect(() => {
    let activeRequest = true
    getStudentDashboard()
      .then((data) => {
        if (activeRequest) setDashboard(data)
      })
      .catch((requestError) => {
        if (activeRequest) setPageError(requestError.message)
      })
      .finally(() => {
        if (activeRequest) setLoading(false)
      })
    return () => {
      activeRequest = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)
    localStorage.setItem("team-platform-theme", darkMode ? "dark" : "light")
  }, [darkMode])

  useEffect(() => {
    setPageError("")
    if (active !== "My Profile" && active !== "My Courses") return undefined

    let activeRequest = true
    const request =
      active === "My Profile" ? getStudentProfile() : getStudentCourses()
    request
      .then((data) => {
        if (!activeRequest) return
        if (active === "My Profile") setProfile(data.student)
        else setCoursePageData(data.courses)
      })
      .catch((requestError) => {
        if (activeRequest) setPageError(requestError.message)
      })
    return () => {
      activeRequest = false
    }
  }, [active])

  useEffect(() => {
    if (active !== "Tasks") return undefined
    let activeRequest = true
    setLoadingTasks(true)
    setTasksError("")
    Promise.all([listTasks(), getStudentTeams()])
      .then(([taskItems, teamData]) => {
        if (!activeRequest) return
        setTasks(Array.isArray(taskItems) ? taskItems : [])
        setMyTeams(Array.isArray(teamData.teams) ? teamData.teams : [])
      })
      .catch((requestError) => {
        if (activeRequest) setTasksError(requestError.message)
      })
      .finally(() => {
        if (activeRequest) setLoadingTasks(false)
      })
    return () => {
      activeRequest = false
    }
  }, [active])

  async function handleJoinTeam(teamId) {
    setJoiningTeam(teamId)
    setJoinMessage("")
    setPageError("")
    try {
      await joinStudentTeam(teamId)
      setJoinMessage("You joined the team.")
    } catch (requestError) {
      setPageError(requestError.message)
      setJoiningTeam(null)
      return
    }

    try {
      const updatedDashboard = await getStudentDashboard()
      setDashboard(updatedDashboard)
    } catch (requestError) {
      setPageError(`You joined the team, but the dashboard could not refresh: ${requestError.message}`)
    } finally {
      setJoiningTeam(null)
    }
  }

  async function loadCourseProject(courseId, projectId = null) {
    setProjectLoading(true)
    setProjectError("")
    try {
      const data = await getStudentCourseTeams(courseId, projectId)
      setProjectData(data)
      if (projectId === null && data?.project?.id) setSelectedProjectId(data.project.id)
    } catch (requestError) {
      setProjectError(requestError.message)
    } finally {
      setProjectLoading(false)
    }
  }

  function handleViewProject(course) {
    setSelectedCourse(course)
    setSelectedProjectId(null)
    setProjectData(null)
    setProjectError("")
    setProjectMessage("")
    setTeamName("")
    setActive("Course Project")
    loadCourseProject(course.id)
  }

  function handleSelectProject(projectId) {
    setSelectedProjectId(Number(projectId))
    setProjectMessage("")
    setTeamName("")
    loadCourseProject(selectedCourse.id, projectId)
  }

  function handleBackToCourses() {
    setSelectedCourse(null)
    setSelectedProjectId(null)
    setProjectData(null)
    setProjectError("")
    setProjectMessage("")
    setActive("My Courses")
  }

  async function handleCreateTeam(event) {
    event.preventDefault()
    if (!projectData?.project) return
    setProjectError("")
    setProjectMessage("")
    setCreatingTeam(true)
    try {
      const result = await createStudentTeam({
        projectId: projectData.project.id,
        name: teamName.trim() || `Team ${Date.now()}`,
      })
      const createdTeam = result.team || result
      setTeamName("")
      setProjectMessage(`Team "${createdTeam.name}" created successfully.`)
      await loadCourseProject(selectedCourse.id, selectedProjectId)
      const updatedDashboard = await getStudentDashboard()
      setDashboard(updatedDashboard)
    } catch (requestError) {
      setProjectError(requestError.message)
    } finally {
      setCreatingTeam(false)
    }
  }

  async function handleJoinProjectTeam(teamId) {
    setJoiningTeam(teamId)
    setProjectError("")
    setProjectMessage("")
    try {
      await joinStudentTeam(teamId)
      setProjectMessage("You joined the team.")
      await loadCourseProject(selectedCourse.id, selectedProjectId)
      const updatedDashboard = await getStudentDashboard()
      setDashboard(updatedDashboard)
    } catch (requestError) {
      setProjectError(requestError.message)
    } finally {
      setJoiningTeam(null)
    }
  }

  async function handleSaveAccount({ email, currentPassword, newPassword }) {
    const response = await updateStudentAccount({ email, currentPassword, newPassword })
    const updatedEmail = response?.user?.email || email
    const updatedProfile = { ...dashboard.student, email: updatedEmail }
    setDashboard((current) => ({ ...current, student: updatedProfile }))
    setProfile(updatedProfile)
    return response
  }

  function handleTaskCreated(task) {
    setTasks((items) => [task, ...items])
    setCreatingTask(false)
    setTaskNotice("Task created successfully.")
  }

  function handleTaskUpdated(updated) {
    setTasks((items) => items.map((item) => (item.id === updated.id ? updated : item)))
    setSelectedTask(updated)
  }

  function handleTaskDeleted(taskId) {
    setTasks((items) => items.filter((item) => item.id !== taskId))
    setSelectedTask(null)
    setTaskNotice("Task deleted.")
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5faf9] text-sm text-[#6d898b]" role="status">
        Loading your student dashboard...
      </main>
    )
  }

  if (pageError && !dashboard) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5faf9] p-6 text-sm text-[#a94646]" role="alert">
        {pageError}
      </main>
    )
  }

  if (!dashboard) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5faf9] p-6 text-sm text-[#a94646]" role="alert">
        Unable to load the student dashboard.
      </main>
    )
  }

  const student = dashboard?.student || {}
  const courses = Array.isArray(dashboard?.courses) ? dashboard.courses : []
  const deadlines = Array.isArray(dashboard?.deadlines) ? dashboard.deadlines : []
  const availableTeams = Array.isArray(dashboard?.available_teams)
    ? dashboard.available_teams
    : []

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="theme-page min-h-screen bg-[#f5faf9] text-[#183f43] transition-colors duration-300">
        <Sidebar
          active={active === "Course Project" ? "My Courses" : active}
          onSelect={setActive}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
          student={student}
          onLogout={onLogout}
        />
        <main
          className={`min-h-screen transition-[margin] duration-300 ${
            sidebarCollapsed ? "lg:ml-[88px]" : "lg:ml-[272px]"
          }`}
        >
          <header className="theme-header sticky top-0 z-30 flex h-[76px] items-center border-b border-[#003C43]/8 bg-[#f5faf9]/90 px-4 backdrop-blur-xl transition-colors sm:px-8 lg:px-10">
            <button
              className="theme-control mr-3 rounded-xl border border-[#003C43]/10 bg-white p-2.5 text-[#003C43] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#77B0AA]">
                Student portal
              </div>
              <div className="truncate text-lg font-bold text-[#003C43]">
                {active === "Course Project" ? "Project details" : active}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div
                className={`${
                  searchOpen ? "flex" : "hidden"
                } theme-control absolute left-4 right-4 top-[82px] items-center rounded-xl border border-[#003C43]/10 bg-white px-3 shadow-xl sm:static sm:flex sm:w-60 sm:shadow-none`}
              >
                <Icon name="search" className="h-4 w-4 text-[#77B0AA]" />
                <input
                  aria-label="Search courses"
                  className="w-full bg-transparent px-3 py-2.5 text-sm text-[#003C43] outline-none placeholder:text-[#7d999b]"
                  placeholder="Search courses..."
                  autoFocus={searchOpen}
                />
              </div>
              <button
                className="theme-control grid h-10 w-10 place-items-center rounded-xl border border-[#003C43]/10 bg-white text-[#135D66] sm:hidden"
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Search"
              >
                <Icon name="search" className="h-[18px] w-[18px]" />
              </button>
              <button
                className="theme-control grid h-10 w-10 place-items-center rounded-xl border border-[#003C43]/10 bg-white text-[#135D66] transition hover:border-[#77B0AA] hover:bg-[#E3FEF7]"
                onClick={() => setDarkMode(!darkMode)}
                aria-label={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
                aria-pressed={darkMode}
                title={darkMode ? "Light mode" : "Dark mode"}
              >
                <Icon
                  name={darkMode ? "sun" : "moon"}
                  className="h-[18px] w-[18px]"
                />
              </button>
              <div className="hidden h-8 w-px bg-[#003C43]/10 sm:block" />
              <div className="hidden items-center gap-2.5 sm:flex">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#135D66] text-xs font-bold text-white">
                  {`${(student.first_name || "?")[0]}${(student.last_name || "?")[0]}`}
                </div>
                <div className="hidden xl:block">
                  <div className="text-xs font-bold text-[#003C43]">
                    {student.full_name}
                  </div>
                  <div className="text-[10px] text-[#6d898b]">
                    {student.major || student.domain || "Student"}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-4 sm:p-8 lg:p-10">
            {pageError && <p className="mb-5 rounded-xl bg-[#fff0f0] p-4 text-xs text-[#a94646]" role="alert">{pageError}</p>}
            {joinMessage && <p className="mb-5 rounded-xl bg-[#E3FEF7] p-4 text-xs text-[#135D66]" role="status">{joinMessage}</p>}
            {active === "Overview" ? (
              <>
                <section className="relative overflow-hidden rounded-[24px] bg-[#135D66] px-6 py-7 text-white shadow-[0_12px_35px_rgba(0,60,67,0.14)] sm:px-9 sm:py-8">
                  <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full border-[38px] border-[#77B0AA]/20" />
                  <div className="absolute bottom-[-74px] right-[18%] h-40 w-40 rounded-full bg-[#E3FEF7]/[0.06]" />
                  <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div>
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#E3FEF7]">
                        <Icon name="spark" className="h-3.5 w-3.5" />
                        {new Date().toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      <h1 className="text-2xl font-bold tracking-tight sm:text-[30px]">
                        {student.greeting}
                      </h1>
                      <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">
                        You have {dashboard.courses.length} enrolled courses and{" "}
                        {deadlines.length} upcoming deadlines.
                      </p>
                    </div>
                    <button onClick={() => setActive("My Profile")} className="theme-invert flex w-fit items-center gap-2 rounded-xl bg-[#E3FEF7] px-4 py-2.5 text-xs font-bold text-[#003C43] shadow-lg shadow-black/10 transition hover:bg-white">
                      View my profile{" "}
                      <Icon name="arrow" className="h-4 w-4" />
                    </button>
                  </div>
                </section>

                <section className="mt-8">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-[#003C43]">
                        My courses
                      </h2>
                      <p className="mt-1 text-xs text-[#6d898b]">
                        Your enrolled courses
                      </p>
                    </div>
                    <button onClick={() => setActive("My Courses")} className="flex items-center gap-1 text-xs font-bold text-[#135D66] transition hover:text-[#003C43]">
                      View all <Icon name="chevron" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-3">
                    {courses.map((course) => (
                      <CourseCard key={course.id} course={course} onOpen={() => setActive("My Courses")} />
                    ))}
                    {dashboard.courses.length === 0 && (
                      <p className="text-xs text-[#6d898b]">You are not enrolled in any courses yet.</p>
                    )}
                  </div>
                </section>

                <div className="mt-7 grid items-stretch gap-6 lg:grid-cols-2">
                  <section className="theme-surface h-full rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] transition-colors sm:p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-[#003C43]">
                          Upcoming deadlines
                        </h2>
                        <p className="mt-1 text-xs text-[#7b9294]">
                          Stay on top of your coursework
                        </p>
                      </div>
                      <button
                        className="rounded-lg border border-[#003C43]/10 p-2 text-[#135D66] transition hover:bg-[#E3FEF7]"
                        aria-label="View calendar"
                      >
                        <Icon name="calendar" className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="divide-y divide-[#003C43]/7">
                      {deadlines.map((item) => {
                        const dueDate = new Date(item.due_date)
                        return (
                        <article
                          key={item.id}
                          className="flex items-center gap-4 py-4 first:pt-1 last:pb-0"
                        >
                          <div className="theme-soft grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#f0f7f6] text-center">
                            <div>
                              <div className="text-lg font-extrabold leading-5 text-[#003C43]">
                                {dueDate.getDate()}
                              </div>
                              <div className="text-[9px] font-bold tracking-[0.12em] text-[#77B0AA]">
                                {dueDate.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-[#18484d]">
                              {item.title}
                            </div>
                            <div className="mt-1 truncate text-[11px] text-[#718b8d]">
                              {item.course.name}
                            </div>
                          </div>
                          <div className="hidden text-right sm:block">
                            <span
                              className="rounded-md bg-[#dff8f3] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#135D66]"
                            >
                              {item.status.replace("_", " ")}
                            </span>
                            <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-[#718b8d]">
                              <Icon name="clock" className="h-3 w-3" />
                              {dueDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </div>
                          </div>
                          <button
                            className="text-[#77B0AA] hover:text-[#003C43]"
                            aria-label={`Open ${item.title}`}
                          >
                            <Icon name="chevron" className="h-4 w-4" />
                          </button>
                        </article>
                        )
                      })}
                      {deadlines.length === 0 && (
                        <p className="py-4 text-xs text-[#6d898b]">No upcoming deadlines.</p>
                      )}
                    </div>
                  </section>

                  <section className="theme-surface h-full rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] transition-colors sm:p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-[#003C43]">
                          Available teams
                        </h2>
                        <p className="mt-1 text-xs text-[#7b9294]">
                          Find a team for your course projects
                        </p>
                      </div>
                      <span className="rounded-full bg-[#E3FEF7] px-2.5 py-1 text-[10px] font-bold text-[#135D66]">
                        {availableTeams.length} open
                      </span>
                    </div>
                    <div className="divide-y divide-[#003C43]/7">
                      {availableTeams.map((team) => (
                        <article
                          key={team.id}
                          className="flex items-center gap-3 py-4 first:pt-1 last:pb-0"
                        >
                          <div className="theme-soft grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#f0f7f6] text-[#135D66]">
                            <Icon name="users" className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-[#18484d]">
                              {team.name}
                            </div>
                            <div className="mt-1 truncate text-[10px] text-[#718b8d]">
                              {team.course.name}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex -space-x-1.5">
                                {team.members.map((member) => (
                                  <span
                                    key={member.id}
                                    className="theme-invert grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-[#77B0AA] text-[7px] font-extrabold text-[#003C43]"
                                  >
                                    {member.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                                  </span>
                                ))}
                              </div>
                              <span className="text-[9px] font-semibold text-[#77B0AA]">
                                {team.available_spots}{" "}
                                {team.available_spots === 1
                                  ? "spot"
                                  : "spots"}{" "}
                                left
                              </span>
                            </div>
                          </div>
                          <button disabled={joiningTeam === team.id} onClick={() => handleJoinTeam(team.id)} className="rounded-lg bg-[#E3FEF7] px-3 py-2 text-[10px] font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43] disabled:cursor-wait disabled:opacity-60">
                            {joiningTeam === team.id ? "Joining..." : "Join team"}
                          </button>
                        </article>
                      ))}
                      {availableTeams.length === 0 && (
                        <p className="py-4 text-xs text-[#6d898b]">No available teams were found for your courses.</p>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ) : active === "My Profile" ? (
              profile ? <ProfilePage profile={profile} onRefreshProfile={async () => { const data = await getStudentProfile(); setProfile(data.student) }} /> : pageError ? <p className="text-xs text-[#a94646]" role="alert">{pageError}</p> : <p className="text-xs text-[#6d898b]" role="status">Loading your profile...</p>
            ) : active === "My Courses" ? (
              coursePageData ? <CoursesPage courses={coursePageData} onViewProject={handleViewProject} /> : pageError ? <p className="text-xs text-[#a94646]" role="alert">{pageError}</p> : <p className="text-xs text-[#6d898b]" role="status">Loading your courses...</p>
            ) : active === "Course Project" ? (
              selectedCourse ? (
                <CourseProjectPage
                  course={selectedCourse}
                  data={projectData}
                  loading={projectLoading}
                  error={projectError}
                  message={projectMessage}
                  teamName={teamName}
                  creatingTeam={creatingTeam}
                  joiningTeam={joiningTeam}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={handleSelectProject}
                  onTeamNameChange={setTeamName}
                  onCreateTeam={handleCreateTeam}
                  onJoinTeam={handleJoinProjectTeam}
                  onBack={handleBackToCourses}
                />
              ) : (
                <p className="text-xs text-[#6d898b]" role="status">Select a course to view its project.</p>
              )
            ) : active === "Tasks" ? (
              <TasksPage
                tasks={tasks}
                myTeams={myTeams}
                courses={courses}
                loading={loadingTasks}
                error={tasksError}
                notice={taskNotice}
                courseFilter={taskCourseFilter}
                projectFilter={taskProjectFilter}
                statusFilter={taskStatusFilter}
                onCourseFilterChange={setTaskCourseFilter}
                onProjectFilterChange={setTaskProjectFilter}
                onStatusFilterChange={setTaskStatusFilter}
                onCreate={() => { setTaskNotice(""); setCreatingTask(true) }}
                onOpen={(task) => { setTaskNotice(""); setSelectedTask(task) }}
              />
            ) : (
              <SettingsPage
                student={student}
                onSaveAccount={handleSaveAccount}
                onRequestPasswordReset={onRequestPasswordReset}
              />
            )}
            {selectedTask && (
              <TaskDetailsModal
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                canManage
                viewerRole="student"
                currentUserId={student.id}
                onTaskUpdated={handleTaskUpdated}
                onTaskDeleted={handleTaskDeleted}
              />
            )}
            {creatingTask && (
              <StudentTaskCreateModal
                teams={myTeams}
                onClose={() => setCreatingTask(false)}
                onCreated={handleTaskCreated}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
