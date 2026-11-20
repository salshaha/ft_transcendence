import { useEffect, useState } from "react"
import {
  addStudentSkill,
  getAvailableSkills,
  getStudentCourses,
  getStudentDashboard,
  getStudentProfile,
  joinStudentTeam,
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

function CoursesPage({ courses }) {
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
                Project details are not available yet.
              </h3>
              <button disabled title="Project details API is not available" className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-[#135D66] px-3 py-2.5 text-[10px] font-bold text-white opacity-60">
                Project details unavailable
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

function SettingsPage({ student, onSaveAccount }) {
  const [email, setEmail] = useState(student.email)
  const [currentPassword, setCurrentPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const saveDetails = async (event) => {
    event.preventDefault()
    setMessage("")
    if (!email.includes("@")) {
      setError("Enter a valid email address.")
      return
    }
    if (!currentPassword) {
      setError("Enter your current password to save changes.")
      return
    }
    setError("")
    setSaving(true)
    try {
      await onSaveAccount({ email, currentPassword })
      setCurrentPassword("")
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

        <section className="theme-surface h-fit rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-7">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f5f3ff] text-[#6D5BD0]">
            <Icon name="settings" />
          </div>
          <h2 className="mt-5 text-lg font-extrabold text-[#003C43]">
            Password & security
          </h2>
          <p className="mt-2 text-xs leading-5 text-[#6d898b]">
            Password reset is not available because the backend does not yet
            provide a reset-link workflow.
          </p>
          <button
            disabled
            title="Password reset is not available yet"
            className="mt-6 w-full cursor-not-allowed rounded-xl border border-[#6D5BD0]/25 px-4 py-3 text-xs font-bold text-[#6D5BD0] opacity-60"
          >
            Reset password unavailable
          </button>
        </section>
      </div>
    </div>
  )
}

export default function StudentDashboard({ onLogout }) {
  const [active, setActive] = useState("Overview")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [profile, setProfile] = useState(null)
  const [coursePageData, setCoursePageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [joiningTeam, setJoiningTeam] = useState(null)
  const [joinMessage, setJoinMessage] = useState("")

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

  async function handleSaveAccount({ email, currentPassword }) {
    await updateStudentAccount({ email, currentPassword })
    const updatedProfile = { ...dashboard.student, email }
    setDashboard((current) => ({ ...current, student: updatedProfile }))
    setProfile(updatedProfile)
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
          active={active}
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
                {active}
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
                <Icon
                  name="chevron"
                  className="h-3.5 w-3.5 rotate-90 text-[#77B0AA]"
                />
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
                    <button onClick={() => setActive("My Courses")} className="theme-invert flex w-fit items-center gap-2 rounded-xl bg-[#E3FEF7] px-4 py-2.5 text-xs font-bold text-[#003C43] shadow-lg shadow-black/10 transition hover:bg-white">
                      View my courses{" "}
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
              coursePageData ? <CoursesPage courses={coursePageData} /> : pageError ? <p className="text-xs text-[#a94646]" role="alert">{pageError}</p> : <p className="text-xs text-[#6d898b]" role="status">Loading your courses...</p>
            ) : (
              <SettingsPage student={student} onSaveAccount={handleSaveAccount} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
