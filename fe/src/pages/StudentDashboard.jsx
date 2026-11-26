import { useEffect, useState } from "react"
import PasswordSecurityCard from "../components/auth/PasswordSecurityCard"
import TaskDetailsModal from "../components/instructor/TaskDetailsModal"
import Avatar from "../components/student/Avatar"
import AvatarManager from "../components/student/AvatarManager"
import SkillManager from "../components/student/SkillManager"
import ConfirmDialog from "../components/student/ConfirmDialog"
import FriendsPage from "../components/student/FriendsPage"
import ProjectFeedbackPanel from "../components/student/ProjectFeedbackPanel"
import ProjectSubmission from "../components/student/ProjectSubmission"
import SettingsPage from "../components/SettingsPage"
import { formatDate, statusTone } from "../components/instructor/formatters"
import MyGrades from "../components/student/MyGrades"
import StudentTaskCreateModal from "../components/student/StudentTaskCreateModal"
import TaskKanbanBoard from "../components/student/TaskKanbanBoard"
import TeamChatPanel from "../components/student/TeamChatPanel"
import TeamPreviewModal from "../components/student/TeamPreviewModal"
import { formatLastSeen, resolvePresence } from "../components/student/studentFormatters"
import { useRealtimeConnection, useTeamRealtime } from "../hooks/useTeamRealtime"
import { usePresence } from "../hooks/usePresence"
import StudentsPage from "./StudentsPage"
import { removeById, upsertById } from "../services/realtimeReducers"
import { listTasks, updateTask } from "../services/taskService"
import {
  createStudentTeam,
  getStudentCourseTeams,
  getStudentCourses,
  getStudentDashboard,
  getStudentProfile,
  getStudentTeamPreview,
  getStudentTeams,
  joinStudentTeam,
  leaveStudentTeam,
  openStudentProjectRequirements,
  removeStudentTeamMember,
  transferStudentTeamLeadership,
  updateMyProfile,
  updateStudentAccount,
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
  chat: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 10h8M8 14h5" />
    </>
  ),
  userPlus: (
    <>
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
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
  { label: "Students", icon: "users" },
  { label: "My Courses", icon: "book" },
  { label: "Team Chats", icon: "chat" },
  { label: "Friends", icon: "userPlus" },
  { label: "Tasks", icon: "clipboard" },
  { label: "My Grades", icon: "file" },
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
  presence,
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
                   ? "bg-[#135D66] text-white shadow-lg shadow-black/15"

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
            <Avatar
              user={student}
              className="h-10 w-10"
              showPresence
              presence={{ online: resolvePresence(presence, student).online }}
            />
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
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#135D66]">
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

function ProfilePage({ profile, presence, onChanged, onPreviewTeam, onLeaveTeam }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    major: profile.major || "",
    domain: profile.domain || "",
    joined_year: profile.joined_year || "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    setForm({
      major: profile.major || "",
      domain: profile.domain || "",
      joined_year: profile.joined_year || "",
    })
  }, [profile])

  const selfPresence = resolvePresence(presence, profile)
  const online = selfPresence.online
  const team = profile.team || profile.current_project?.team || null

  async function saveDetails(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await updateMyProfile({
        major: form.major.trim(),
        domain: form.domain.trim(),
        joined_year: form.joined_year ? Number(form.joined_year) : "",
      })
      setMessage("Profile details updated.")
      setEditing(false)
      if (onChanged) await onChanged()
    } catch (requestError) {
      setError(requestError.message || "Unable to update profile.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Student profile"
        title="My Profile"
        description="Keep your academic identity, skills, and project presence up to date."
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)]">
          <AvatarManager user={profile} onChanged={onChanged} />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold text-[#003C43]">
              {profile.full_name}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                online
                  ? "bg-[#dff8f3] text-[#135D66]"
                  : "bg-[#eef4f3] text-[#718b8d]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  online ? "bg-[#22c55e]" : "bg-[#9ca3af]"
                }`}
              />
              {online ? "Online now" : formatLastSeen(selfPresence.last_seen)}
            </span>
          </div>

          <p className="mt-1 text-xs font-semibold text-[#6d898b]">
            {profile.email}
          </p>

          {error ? (
            <div className="mt-4 rounded-xl bg-[#fff0f0] px-3 py-2 text-[11px] font-semibold text-[#a94646]">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-4 rounded-xl bg-[#E3FEF7] px-3 py-2 text-[11px] font-semibold text-[#135D66]">
              {message}
            </div>
          ) : null}

          {editing ? (
            <form onSubmit={saveDetails} className="mt-5 space-y-3 border-t border-[#003C43]/8 pt-5">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">
                Major
                <input
                  value={form.major}
                  onChange={(event) => setForm((current) => ({ ...current, major: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#003C43]/12 px-3 py-2 text-xs font-semibold text-[#18484d] outline-none focus:border-[#135D66]"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">
                Academic department
                <input
                  value={form.domain}
                  onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#003C43]/12 px-3 py-2 text-xs font-semibold text-[#18484d] outline-none focus:border-[#135D66]"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">
                Joined year
                <input
                  type="number"
                  min="1990"
                  max="2100"
                  value={form.joined_year}
                  onChange={(event) => setForm((current) => ({ ...current, joined_year: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#003C43]/12 px-3 py-2 text-xs font-semibold text-[#18484d] outline-none focus:border-[#135D66]"
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-[#003C43]/15 px-3 py-2 text-[11px] font-bold text-[#003C43]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#135D66] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save details"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 space-y-4 border-t border-[#003C43]/8 pt-5">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">
                  Major
                </div>
                <div className="mt-1 text-xs font-bold text-[#18484d]">
                  {profile.major || "Not provided"}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">
                  Academic department
                </div>
                <div className="mt-1 text-xs font-bold text-[#18484d]">
                  {profile.domain || "Not provided"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">Student ID</div>
                  <div className="mt-1 text-[11px] font-bold text-[#18484d]">
                    {profile.student_id || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">Joined</div>
                  <div className="mt-1 text-[11px] font-bold text-[#18484d]">
                    {profile.joined_year || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">GPA</div>
                  <div className="mt-1 text-[11px] font-bold text-[#18484d]">
                    {profile.gpa === null || profile.gpa === undefined
                      ? "—"
                      : Number(profile.gpa).toFixed(2)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-xl border border-[#77B0AA]/50 px-3 py-2 text-[11px] font-bold text-[#135D66] transition hover:bg-[#E3FEF7]"
              >
                Edit details
              </button>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)]">
            <h3 className="text-sm font-extrabold text-[#003C43]">Academic context</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(profile.courses || []).map((course) => (
                <span
                  key={course.id}
                  className="rounded-xl bg-[#E3FEF7] px-2.5 py-1.5 text-[11px] font-bold text-[#135D66]"
                >
                  {course.name}
                </span>
              ))}
              {(profile.courses || []).length === 0 ? (
                <span className="text-xs text-[#718b8d]">No courses enrolled yet.</span>
              ) : null}
            </div>

            {profile.current_project ? (
              <div className="mt-4 rounded-2xl border border-[#003C43]/8 bg-[#f5faf9] p-4">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">
                  Current project
                </div>
                <div className="mt-1 text-sm font-extrabold text-[#003C43]">
                  {profile.current_project.title}
                </div>
                {team ? (
                  <div className="mt-3">
                    <div className="text-[11px] font-bold text-[#135D66]">
                      {team.name} · {team.status?.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-[11px] text-[#718b8d]">
                      {team.current_member_count || team.members?.length || 0}/{team.max_members} members · {team.available_spots ?? 0} open · min {team.min_members || 1}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(team.members || []).map((member) => (
                        <span
                          key={member.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#77B0AA]/35 bg-white py-1 pl-1 pr-2 text-[10px] font-bold text-[#003C43]"
                          title={formatLastSeen(member.last_seen)}
                        >
                          <Avatar
                            user={member}
                            className="h-6 w-6"
                            rounded="rounded-full"
                            showPresence
                            presence={{
                              online: resolvePresence(presence, member).online,
                            }}
                          />
                          {member.name}
                          {member.id === team.leader_id ? " · Leader" : ""}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {onPreviewTeam ? (
                        <button
                          type="button"
                          onClick={() => onPreviewTeam(team.id)}
                          className="rounded-lg bg-[#E3FEF7] px-3 py-1.5 text-[10px] font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43]"
                        >
                          View team
                        </button>
                      ) : null}
                      {onLeaveTeam ? (
                        <button
                          type="button"
                          onClick={() => onLeaveTeam(team.id)}
                          className="rounded-lg border border-[#dc2626]/30 px-3 py-1.5 text-[10px] font-bold text-[#dc2626] transition hover:bg-[#fee2e2]"
                        >
                          Leave team
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-[#718b8d]">No team yet for this project.</p>
                )}
              </div>
            ) : null}
          </section>

          <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)]">
            <SkillManager
              skills={profile.skills || []}
              onChanged={async () => {
                if (onChanged) await onChanged()
              }}
            />
          </section>
        </div>
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

            <div className="mx-5 mb-5 rounded-xl bg-[#E3FEF7] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#135D66]">
                  Current project
                </span>
                <Icon name="file" className="h-4 w-4 text-[#135D66]" />
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
  presence,
  loading,
  error,
  message,
  teamName,
  creatingTeam,
  joiningTeam,
  leavingTeam,
  selectedProjectId,
  teamFilters,
  onTeamFiltersChange,
  onSelectProject,
  onTeamNameChange,
  onCreateTeam,
  onJoinTeam,
  onPreviewTeam,
  onLeaveTeam,
  onSubmissionChanged,
  currentUserId,
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
              <div className="text-xs font-semibold text-[#365c60]">Viewing project: <span className="font-bold text-[#003C43]">{project.title || `Project ${project.id}`}</span>. Use the Teams filter below to switch project or filter availability.</div>
            </section>
          )}
          <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#135D66]">
                  Project brief
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#587376]">
                  {project.description || project.prd || "No description has been added for this project."}
                </p>
                {data?.course?.instructor ? (
                  <div className="mt-4 text-xs font-semibold text-[#135D66]">
                    Instructor: {data.course.instructor.name}
                  </div>
                ) : null}
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
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => openStudentProjectRequirements(project.id)}
                  className="flex w-fit items-center justify-center gap-2 rounded-lg bg-[#E3FEF7] px-4 py-3 text-xs font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43]"
                >
                  <Icon name="file" className="h-4 w-4" />
                  Preview requirements PDF
                </button>
                <button
                  onClick={() => openStudentProjectRequirements(project.id, { download: true })}
                  className="flex w-fit items-center justify-center gap-2 rounded-lg border border-[#003C43]/15 px-4 py-3 text-xs font-bold text-[#003C43] transition hover:bg-[#E3FEF7]"
                >
                  Download PDF
                </button>
                <div className="self-center text-[11px] text-[#718b8d]">
                  {project.requirements.original_name || "requirements.pdf"}
                </div>
              </div>
            )}
          </section>

          <ProjectSubmission
            teamId={teams.find((team) => team.is_member)?.id || null}
            project={project}
            onSubmitted={onSubmissionChanged}
          />

          <ProjectFeedbackPanel
            project={project}
            teamId={teams.find((team) => team.is_member)?.id || null}
            teammates={teams.find((team) => team.is_member)?.members || []}
            currentUserId={currentUserId}
          />

          <section className="theme-surface mt-6 rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#003C43]">Classmates</h2>
                <p className="mt-1 text-xs text-[#6d898b]">Students enrolled in this course.</p>
              </div>
              <span className="rounded-full bg-[#E3FEF7] px-2.5 py-1 text-[10px] font-bold text-[#135D66]">
                {(data?.classmates || []).length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(data?.classmates || []).map((classmate) => (
                <div key={classmate.id} className="flex items-center gap-3 rounded-xl border border-[#003C43]/8 bg-[#f8fcfb] p-3">
                  <Avatar user={classmate} className="h-9 w-9" showPresence presence={{ online: resolvePresence(presence, classmate).online }} />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-[#003C43]">
                      {classmate.name}{classmate.is_self ? " (You)" : ""}
                    </div>
                    <div className="truncate text-[10px] text-[#718b8d]">{classmate.is_self ? "Your account" : "Classmate"}</div>
                  </div>
                </div>
              ))}
              {(data?.classmates || []).length === 0 && (
                <p className="text-xs text-[#6d898b]">No classmates found.</p>
              )}
            </div>
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
                  className="theme-control flex-1 rounded-xl border border-[#003C43]/10 bg-white px-4 py-2.5 text-sm text-[#003C43] outline-none transition focus:border-[#135D66] focus:ring-4 focus:ring-[#135D66]/10"
                />
                <button
                  type="submit"
                  disabled={creatingTeam}
                  className="rounded-xl bg-[#135D66] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#003C43] disabled:cursor-wait disabled:opacity-60"
                >
                  {creatingTeam ? "Creating..." : "Create team"}
                </button>
              </form>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#003C43]">Teams in this course</h2>
                <p className="mt-1 text-xs text-[#6d898b]">
                  Search and filter teams by name, project, or availability.
                </p>
              </div>
              <span className="rounded-full bg-[#E3FEF7] px-2.5 py-1 text-[10px] font-bold text-[#135D66]">
                {teams.length} {teams.length === 1 ? "team" : "teams"}
              </span>
            </div>
            <div className="mb-4 grid gap-3 rounded-2xl border border-[#003C43]/8 bg-white p-4 shadow-sm sm:grid-cols-3">
              <label className="block text-xs font-bold text-[#003C43]">
                Team name
                <input
                  value={teamFilters?.search || ""}
                  onChange={(event) => onTeamFiltersChange({ ...teamFilters, search: event.target.value })}
                  placeholder="Search team name"
                  className="mt-1.5 w-full rounded-xl border border-[#003C43]/15 px-3 py-2 text-sm outline-none focus:border-[#135D66]"
                />
              </label>
              <label className="block text-xs font-bold text-[#003C43]">
                Project
                <select
                  value={selectedProjectId || project.id}
                  onChange={(event) => onSelectProject(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#135D66]"
                >
                  {projects.map((item) => <option key={item.id} value={item.id}>{item.title || `Project ${item.id}`}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-[#003C43]">
                Availability
                <select
                  value={teamFilters?.availability || ""}
                  onChange={(event) => onTeamFiltersChange({ ...teamFilters, availability: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#135D66]"
                >
                  <option value="">All teams</option>
                  <option value="available">Available</option>
                  <option value="full">Full</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
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
                    <span className="shrink-0 rounded-md bg-[#E3FEF7] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#135D66]">
                      {team.status || "forming"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                         {team.members.map((member) => (
                           <Avatar
                             key={member.id}
                             user={{
                               id: member.id,
                               first_name: member.name?.split(" ")[0],
                               last_name: member.name?.split(" ").slice(1).join(" "),
                               profile_picture: member.profile_picture,
                             }}
                             className="h-6 w-6"
                             rounded="rounded-full"
                             showPresence
                             presence={{ online: resolvePresence(presence, member).online }}
                           />
                         ))}

                      </div>
                      <span className="text-[10px] font-semibold text-[#718b8d]">
                        {team.current_member_count}/{team.max_members}
                      </span>
                      <span className="text-[10px] font-semibold text-[#718b8d]">
                        {team.available_spots} spot{team.available_spots === 1 ? "" : "s"} open
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {onPreviewTeam && (
                        <button
                          type="button"
                          onClick={() => onPreviewTeam(team.id)}
                          className="rounded-lg border border-[#003C43]/15 px-3 py-2 text-[10px] font-bold text-[#003C43] transition hover:bg-[#E3FEF7]"
                        >
                          View
                        </button>
                      )}
                      {team.is_member ? (
                        <button
                          type="button"
                          disabled={leavingTeam === team.id}
                          onClick={() => onLeaveTeam(team.id)}
                          className="rounded-lg border border-[#dc2626]/30 px-3 py-2 text-[10px] font-bold text-[#dc2626] transition hover:bg-[#fee2e2] disabled:opacity-60"
                        >
                          {leavingTeam === team.id ? "Leaving..." : "Leave"}
                        </button>
                      ) : (
                        <button
                          disabled={
                            joiningTeam === team.id ||
                            team.can_join_after_leaving === false ||
                            (team.can_join_after_leaving === undefined && !team.can_join && team.available_spots <= 0)
                          }
                          onClick={() => onJoinTeam(team.id)}
                          className="rounded-lg bg-[#E3FEF7] px-3 py-2 text-[10px] font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43] disabled:cursor-not-allowed disabled:opacity-60"
                          title={team.join_blocked_reason || "Join this team"}
                        >
                          {joiningTeam === team.id
                            ? "Joining..."
                            : team.requires_leave_current_team
                              ? "Leave current to join"
                              : team.available_spots <= 0
                                ? "Full"
                                : team.is_closed
                                  ? "Closed"
                                  : "Join team"}
                        </button>
                      )}
                    </div>
                  </div>
                  {team.is_member && (
                    <div className="mt-3 text-[10px] font-bold text-[#135D66]">Your team</div>
                  )}
                  {team.join_blocked_reason && !team.is_member && (
                    <div className="mt-2 text-[10px] text-[#718b8d]">{team.join_blocked_reason}</div>
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
  onMove,
  connection,
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
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              connection?.connected
                ? "bg-[#E3FEF7] text-[#135D66]"
                : "bg-[#fff0f0] text-[#a94646]"
            }`}
            title={connection?.error || "Realtime collaboration status"}
          >
            {connection?.connected ? "Live updates on" : "Live updates off"}
          </span>
          <button
            type="button"
            onClick={onCreate}
            disabled={myTeams.length === 0}
            className="rounded-xl bg-[#135D66] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#003C43] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create task
          </button>
        </div>
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

      <p className="mt-4 text-[11px] text-[#718b8d]">
        Drag a card between columns or use its status selector to move a task.
      </p>
      <TaskKanbanBoard
        tasks={visibleTasks}
        loading={loading}
        onOpen={onOpen}
        onMove={onMove}
      />
      {!loading && visibleTasks.length === 0 && (
        <p className="theme-soft mt-4 rounded-xl p-4 text-sm text-[#587376]">
          No tasks match the current filters.
        </p>
      )}
    </section>
  )
}
export default function StudentDashboard({ onLogout, onRequestPasswordReset }) {
  const presence = usePresence()
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
  const [previewTeam, setPreviewTeam] = useState(null)
  const [previewLoadingId, setPreviewLoadingId] = useState(null)
  const [leavingTeamId, setLeavingTeamId] = useState(null)
  const [confirmLeaveTeam, setConfirmLeaveTeam] = useState(null)
  const [teamFilters, setTeamFilters] = useState({ search: "", availability: "" })
  const realtimeStatus = useRealtimeConnection()
  const realtimeTeamIds =
    active === "Tasks"
      ? myTeams.map((team) => team.id)
      : active === "Course Project"
        ? (Array.isArray(projectData?.teams) ? projectData.teams : [])
            .filter((team) => team.is_member)
            .map((team) => team.id)
        : []
  useTeamRealtime(realtimeTeamIds, handleRealtimeEvent)

  function handleRealtimeEvent(event, payload) {
    if (event === "task_deleted") {
      setTasks((items) => removeById(items, payload.task_id))
      setSelectedTask((current) =>
        current?.id === payload.task_id ? null : current,
      )
      return
    }
    if (!event.startsWith("task_") || !payload?.task) return
    const updated = payload.task
    setTasks((items) => upsertById(items, updated))
    setSelectedTask((current) =>
      current?.id === updated.id ? updated : current,
    )
  }

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
      setPreviewTeam(null)
      const updatedDashboard = await getStudentDashboard()
      setDashboard(updatedDashboard)
      if (selectedCourse) await loadCourseProject(selectedCourse.id, selectedProjectId)
    } catch (requestError) {
      const msg = requestError.message || "Unable to join team."
      setPageError(msg)
      try { setDashboard(await getStudentDashboard()) } catch {}
      if (selectedCourse) await loadCourseProject(selectedCourse.id, selectedProjectId)
    } finally {
      setJoiningTeam(null)
    }
  }

  async function loadCourseProject(courseId, projectId = null, filters = null) {
    const nextFilters = filters || teamFilters
    setProjectLoading(true)
    setProjectError("")
    try {
      const data = await getStudentCourseTeams(courseId, {
        projectId,
        search: nextFilters.search || "",
        availability: nextFilters.availability || "",
      })
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
    setTeamFilters({ search: "", availability: "" })
    setActive("Course Project")
    loadCourseProject(course.id, null, { search: "", availability: "" })
  }

  function handleSelectProject(projectId) {
    setSelectedProjectId(Number(projectId))
    setProjectMessage("")
    setTeamName("")
    loadCourseProject(selectedCourse.id, projectId, teamFilters)
  }

  function handleTeamFiltersChange(nextFilters) {
    setTeamFilters(nextFilters)
    if (selectedCourse) loadCourseProject(selectedCourse.id, selectedProjectId, nextFilters)
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
      setPreviewTeam(null)
      await loadCourseProject(selectedCourse.id, selectedProjectId)
      const updatedDashboard = await getStudentDashboard()
      setDashboard(updatedDashboard)
    } catch (requestError) {
      const msg = requestError.message || "Unable to join team."
      setProjectError(msg)
      setPageError(msg)
      if (selectedCourse) await loadCourseProject(selectedCourse.id, selectedProjectId)
      try { setDashboard(await getStudentDashboard()) } catch {}
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

  async function refreshProfile() {
    const [profileData, dashboardData] = await Promise.all([
      getStudentProfile(),
      getStudentDashboard(),
    ])
    setProfile(profileData.student)
    setDashboard(dashboardData)
  }

  async function handlePreviewTeam(teamId) {
    setPreviewLoadingId(teamId)
    setPageError("")
    setProjectError("")
    try {
      const data = await getStudentTeamPreview(teamId)
      setPreviewTeam(data.team || data)
    } catch (requestError) {
      const msg = requestError.message || "Unable to load team preview."
      setPageError(msg)
      setProjectError(msg)
    } finally {
      setPreviewLoadingId(null)
    }
  }

  async function handleLeaveTeam(teamId) {
    setLeavingTeamId(teamId)
    setPageError("")
    setProjectError("")
    setProjectMessage("")
    setJoinMessage("")
    try {
      await leaveStudentTeam(teamId)
      setPreviewTeam(null)
      setConfirmLeaveTeam(null)
      const [dashboardData, profileData] = await Promise.all([
        getStudentDashboard(),
        active === "My Profile" ? getStudentProfile() : Promise.resolve(null),
      ])
      setDashboard(dashboardData)
      if (profileData?.student) setProfile(profileData.student)
      if (selectedCourse) await loadCourseProject(selectedCourse.id, selectedProjectId)
      setProjectMessage("You left the team.")
      setJoinMessage("You left the team.")
    } catch (requestError) {
      const msg = requestError.message || "Unable to leave team."
      setPageError(msg)
      setProjectError(msg)
      throw requestError
    } finally {
      setLeavingTeamId(null)
    }
  }

  async function handleRemoveTeamMember(teamId, memberId) {
    setPageError("")
    try {
      await removeStudentTeamMember(teamId, memberId)
      if (previewTeam?.id === teamId) await handlePreviewTeam(teamId)
      if (selectedCourse) await loadCourseProject(selectedCourse.id, selectedProjectId, teamFilters)
      await refreshProfile()
    } catch (requestError) {
      setPageError(requestError.message || "Unable to remove team member.")
      throw requestError
    }
  }

  async function handleTransferLeadership(teamId, newLeaderId) {
    setPageError("")
    try {
      await transferStudentTeamLeadership(teamId, newLeaderId)
      if (previewTeam?.id === teamId) await handlePreviewTeam(teamId)
      if (selectedCourse) await loadCourseProject(selectedCourse.id, selectedProjectId, teamFilters)
      await refreshProfile()
    } catch (requestError) {
      setPageError(requestError.message || "Unable to transfer leadership.")
      throw requestError
    }
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

  async function handleTaskStatusChange(task, status) {
    if (!status || status === task.status) return
    setTaskNotice("")
    setTasksError("")
    setTasks((items) =>
      items.map((item) => (item.id === task.id ? { ...item, status } : item)),
    )
    setSelectedTask((current) =>
      current?.id === task.id ? { ...current, status } : current,
    )
    try {
      const updated = await updateTask(task.id, { status })
      setTasks((items) => items.map((item) => (item.id === updated.id ? updated : item)))
      setSelectedTask((current) =>
        current?.id === updated.id ? updated : current,
      )
      setTaskNotice(`Task moved to ${status.replaceAll("_", " ")}.`)
    } catch (requestError) {
      setTasks((items) =>
        items.map((item) => (item.id === task.id ? task : item)),
      )
      setSelectedTask((current) => (current?.id === task.id ? task : current))
      setTasksError(requestError.message || "Unable to move the task.")
    }
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
          presence={presence}
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
                <Avatar
                  user={student}
                  className="h-9 w-9"
                  showPresence
                  presence={{ online: resolvePresence(presence, student).online }}
                />
                <div className="hidden xl:block">
                  <div className="text-xs font-bold text-[#003C43]">
                    {student.full_name}
                  </div>
                  <div className="text-[10px] text-[#6d898b]">
                    {resolvePresence(presence, student).online
                      ? "Online now"
                      : formatLastSeen(resolvePresence(presence, student).last_seen)}
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
                                  <Avatar
                                    key={member.id}
                                    user={{
                                      id: member.id,
                                      first_name: member.name?.split(" ")[0],
                                      last_name: member.name?.split(" ").slice(1).join(" "),
                                    }}
                                    className="h-5 w-5"
                                    rounded="rounded-full"
                                    showPresence
                                    presence={{ online: resolvePresence(presence, member).online }}
                                  />
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
                          <div className="flex shrink-0 flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => handlePreviewTeam(team.id)}
                              className="rounded-lg border border-[#003C43]/15 px-3 py-2 text-[10px] font-bold text-[#003C43] transition hover:bg-[#E3FEF7]"
                            >
                              {previewLoadingId === team.id ? "Loading..." : "View"}
                            </button>
                            <button
                              disabled={
                                joiningTeam === team.id ||
                                team.is_member ||
                                team.can_join_after_leaving === false
                              }
                              onClick={() => handleJoinTeam(team.id)}
                              className="rounded-lg bg-[#E3FEF7] px-3 py-2 text-[10px] font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43] disabled:cursor-not-allowed disabled:opacity-60"
                              title={team.join_blocked_reason || "Join this team"}
                            >
                              {joiningTeam === team.id
                                ? "Joining..."
                                : team.is_member
                                  ? "Joined"
                                  : team.requires_leave_current_team
                                    ? "Leave to join"
                                    : team.available_spots <= 0
                                      ? "Full"
                                      : team.is_closed
                                        ? "Closed"
                                        : "Join team"}
                            </button>
                          </div>
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
              profile ? (
                <ProfilePage
                  profile={profile}
                  presence={presence}
                  onChanged={refreshProfile}
                  onPreviewTeam={handlePreviewTeam}
                  onLeaveTeam={(teamId) => setConfirmLeaveTeam({ id: teamId })}
                />
              ) : pageError ? <p className="text-xs text-[#a94646]" role="alert">{pageError}</p> : <p className="text-xs text-[#6d898b]" role="status">Loading your profile...</p>
            ) : active === "Students" ? (
              <StudentsPage presence={presence} />
            ) : active === "Team Chats" ? (
              <TeamChatPanel currentUserId={profile?.id} />
            ) : active === "Friends" ? (
              <FriendsPage presence={presence} />
            ) : active === "My Courses" ? (
              coursePageData ? <CoursesPage courses={coursePageData} onViewProject={handleViewProject} /> : pageError ? <p className="text-xs text-[#a94646]" role="alert">{pageError}</p> : <p className="text-xs text-[#6d898b]" role="status">Loading your courses...</p>
            ) : active === "Course Project" ? (
              selectedCourse ? (
                <CourseProjectPage
                  course={selectedCourse}
                  data={projectData}
                  presence={presence}
                  loading={projectLoading}
                  error={projectError}
                  message={projectMessage}
                  teamName={teamName}
                  creatingTeam={creatingTeam}
                  joiningTeam={joiningTeam}
                  leavingTeam={leavingTeamId}
                  selectedProjectId={selectedProjectId}
                  teamFilters={teamFilters}
                  onTeamFiltersChange={handleTeamFiltersChange}
                  onSelectProject={handleSelectProject}
                  onTeamNameChange={setTeamName}
                  onCreateTeam={handleCreateTeam}
                  onJoinTeam={handleJoinProjectTeam}
                  onPreviewTeam={handlePreviewTeam}
                  onLeaveTeam={(teamId) => setConfirmLeaveTeam({ id: teamId })}
                  currentUserId={profile?.id}
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
                onMove={handleTaskStatusChange}
                connection={realtimeStatus}
              />
            ) : active === "My Grades" ? (
              <MyGrades />
            ) : active === "Settings" ? (
              <SettingsPage
                account={student}
                accountType="student"
                onSaveAccount={handleSaveAccount}
                onRequestPasswordReset={onRequestPasswordReset}
              />
            ) : (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 text-sm text-[#6d898b]">
                This page is not available.
              </section>
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
            {previewTeam && (
              <TeamPreviewModal
                team={previewTeam}
                presence={presence}
                currentUserId={student.id}
                onClose={() => setPreviewTeam(null)}
                onJoin={async (teamId) => {
                  if (selectedCourse) await handleJoinProjectTeam(teamId)
                  else await handleJoinTeam(teamId)
                }}
                onLeave={handleLeaveTeam}
                onRemoveMember={handleRemoveTeamMember}
                onTransferLeadership={handleTransferLeadership}
              />
            )}
            {confirmLeaveTeam && (
              <ConfirmDialog
                title="Leave team?"
                message="You will be removed from this team. You can join another eligible team afterward."
                confirmLabel="Leave team"
                destructive
                onClose={() => setConfirmLeaveTeam(null)}
                onConfirm={() => handleLeaveTeam(confirmLeaveTeam.id)}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
