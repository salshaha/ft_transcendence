import { useEffect, useState } from "react"
import SettingsPage from "../components/SettingsPage"
import FilePreviewModal from "../components/instructor/FilePreviewModal"
import GradeManagement from "../components/instructor/GradeManagement"
import InstructorTeamKanban from "../components/instructor/InstructorTeamKanban"
import PdfPreview from "../components/instructor/PdfPreview"
import ProgressCharts from "../components/instructor/ProgressCharts"
import {
  formatDate,
  statusTone,
  toDateTimeInput,
  toUtcIsoString,
} from "../components/instructor/formatters"
import StudentProfileModal from "../components/instructor/StudentProfileModal"
import SubmissionGradeEditor from "../components/instructor/SubmissionGradeEditor"
import SubmissionTimeline from "../components/instructor/SubmissionTimeline"
import TaskDetailsModal from "../components/instructor/TaskDetailsModal"
import {
  createCourseProject,
  deleteInstructorProject,
  downloadInstructorProjectRequirements,
  fetchInstructorFile,
  getInstructorCourseStudents,
  getInstructorCourses,
  getInstructorDashboard,
  getInstructorGrades,
  getInstructorProjectTeams,
  getInstructorSubmissions,
  getInstructorTeamKanban,
  instructorStudentAvatarUrl,
  instructorSubmissionFileUrl,
  saveFileBlob,
  updateInstructorProject,
  uploadInstructorProjectRequirements,
} from "../services/instructorService"
import { updateAccountInfo } from "../services/authService"
import { listTasks } from "../services/taskService"

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
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
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
  { label: "Courses", icon: "book" },
  { label: "Grades", icon: "clipboard" },
  { label: "Submissions", icon: "file" },
  { label: "Settings", icon: "settings" },
]

function Sidebar({
  active,
  onSelect,
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
  instructor,
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
                  ? "bg-[#E3FEF7] text-[#003C43] shadow-lg shadow-black/10"
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
              {`${instructor.first_name[0]}${instructor.last_name[0]}`}
            </div>
            <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <div className="truncate text-sm font-semibold">
                {instructor.full_name}
              </div>
              <div className="truncate text-[11px] text-white/50">
                {instructor.email}
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

function StudentAvatar({ student, className = "h-11 w-11" }) {
  const [src, setSrc] = useState("")

  useEffect(() => {
    if (!student.profile_picture) {
      setSrc("")
      return undefined
    }
    let active = true
    let objectUrl = ""
    fetchInstructorFile(instructorStudentAvatarUrl(student.id), "Unable to load avatar.")
      .then(({ blob }) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (active) setSrc("")
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [student.id, student.profile_picture])

  const initials = `${student.first_name?.[0] || ""}${student.last_name?.[0] || ""}`
    .trim()
    .toUpperCase()
    .slice(0, 2) || "ST"

  if (src) {
    return (
      <img
        src={src}
        alt={`${student.full_name || "Student"} profile`}
        className={`${className} shrink-0 rounded-xl border border-[#003C43]/10 object-cover`}
      />
    )
  }

  return (
    <div className={`${className} grid shrink-0 place-items-center rounded-xl bg-[#E3FEF7] text-xs font-extrabold text-[#003C43]`}>
      {initials}
    </div>
  )
}

function StudentCard({ student, onClick }) {
  const skills = student.skills || []
  return (
    <button type="button" onClick={onClick} className="theme-surface rounded-xl border border-[#003C43]/10 bg-white p-4 text-left shadow-sm transition hover:border-[#77B0AA] hover:bg-[#f7fbfa]">
      <div className="flex items-center gap-3">
        <StudentAvatar student={student} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-[#003C43]">{student.full_name}</h3>
          <p className="mt-0.5 truncate text-xs text-[#587376]">{student.email}</p>
          <p className="mt-0.5 text-[10px] text-[#718b8d]">
            {student.student_id || `User ${student.id}`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-[#365c60]">
        <span>GPA {student.gpa ?? "—"}</span>
        <span>{skills.length} {skills.length === 1 ? "skill" : "skills"}</span>
      </div>
      {skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skills.slice(0, 4).map((skill) => (
            <span key={`${skill.skill_id}-${skill.name}`} className="rounded-full bg-[#E3FEF7] px-2 py-0.5 text-[9px] font-bold text-[#135D66]">
              {skill.name}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="rounded-full bg-[#f0f7f6] px-2 py-0.5 text-[9px] font-bold text-[#718b8d]">
              +{skills.length - 4}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

function CourseCard({ course, onOpen, onViewStudents }) {
  return (
    <article className="theme-surface group flex min-w-[270px] flex-1 flex-col rounded-2xl border border-[#003C43]/8 bg-white shadow-[0_8px_30px_rgba(0,60,67,0.05)] transition hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(0,60,67,0.10)]">
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col rounded-t-2xl p-5 text-left">
        <div className="flex items-start justify-between">
          <div className="theme-icon grid h-11 w-11 place-items-center rounded-xl bg-[#E3FEF7] text-sm font-extrabold text-[#003C43]">
            {(course.code || course.name).slice(0, 2).toUpperCase()}
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-lg text-[#77B0AA] transition group-hover:bg-[#E3FEF7] group-hover:text-[#003C43]" aria-hidden="true">
            <Icon name="arrow" className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#77B0AA]">
          {course.code}
        </div>
        <h3 className="mt-1 min-h-12 text-[17px] font-bold leading-6 text-[#003C43]">
          {course.name}
        </h3>
        <div className="mt-4 border-t border-[#003C43]/7 pt-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#003C43]">
            <Icon name="users" className="h-3.5 w-3.5 text-[#77B0AA]" />
            {course.student_count}
          </div>
          <div className="mt-0.5 text-[9px] text-[#718b8d]">Students</div>
        </div>
      </button>
      <div className="border-t border-[#003C43]/7 px-5 py-3">
        <button type="button" onClick={onViewStudents} className="flex items-center gap-1.5 text-xs font-bold text-[#135D66] transition hover:text-[#003C43]">
          <Icon name="users" className="h-3.5 w-3.5" />
          View Students
        </button>
      </div>
    </article>
  )
}

export default function FigmaInstructorDashboard({ dashboard, onLogout, onRequestPasswordReset }) {
  const [data, setData] = useState(dashboard)
  const [active, setActive] = useState("Overview")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("team-platform-theme") === "dark")
  const [projectEditor, setProjectEditor] = useState(null)
  const [projectError, setProjectError] = useState("")
  const [formCourses, setFormCourses] = useState([])
  const [loadingFormCourses, setLoadingFormCourses] = useState(false)
  const [formCoursesError, setFormCoursesError] = useState("")
  const [notice, setNotice] = useState("")
  const [savingProject, setSavingProject] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courseStudentsVisible, setCourseStudentsVisible] = useState(false)
  const [courseTeams, setCourseTeams] = useState([])
  const [loadingCourseTeams, setLoadingCourseTeams] = useState(false)
  const [courseTeamsError, setCourseTeamsError] = useState("")
  const [courseStudents, setCourseStudents] = useState([])
  const [loadingCourseStudents, setLoadingCourseStudents] = useState(false)
  const [courseStudentsError, setCourseStudentsError] = useState("")
  const [projectFileError, setProjectFileError] = useState("")
  const [syncingMicrosoftCourses, setSyncingMicrosoftCourses] = useState(false)
  const [microsoftSyncMessage, setMicrosoftSyncMessage] = useState("")
  const [microsoftSyncError, setMicrosoftSyncError] = useState("")
  const { instructor, courses, deadlines, students, projects, submissions, resources, progress } = data
  const [tasks, setTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [tasksError, setTasksError] = useState("")
  const [projectCourseFilter, setProjectCourseFilter] = useState("all")
  const [taskCourseFilter, setTaskCourseFilter] = useState("all")
  const [taskProjectFilter, setTaskProjectFilter] = useState("all")
  const [taskStatusFilter, setTaskStatusFilter] = useState("all")
  const [selectedTask, setSelectedTask] = useState(null)
  const [allSubmissions, setAllSubmissions] = useState([])
  const [submissionGrades, setSubmissionGrades] = useState([])
  const [submissionStudents, setSubmissionStudents] = useState({})
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [submissionsError, setSubmissionsError] = useState("")
  const [studentProfileId, setStudentProfileId] = useState(null)
  const [pdfProject, setPdfProject] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [selectedTeamBoard, setSelectedTeamBoard] = useState(null)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedTeamProjectId, setSelectedTeamProjectId] = useState(null)
  const [teamBoardLoading, setTeamBoardLoading] = useState(false)
  const [teamBoardError, setTeamBoardError] = useState("")
  const [kanbanCourseId, setKanbanCourseId] = useState("")
  const [kanbanProjectId, setKanbanProjectId] = useState("")
  const [kanbanTeams, setKanbanTeams] = useState([])
  const [loadingKanbanTeams, setLoadingKanbanTeams] = useState(false)
  const recentSubmissions = submissions?.items || []
  const visibleStudents = students
  const visibleProjects = projectCourseFilter === "all" ? projects : projects.filter((project) => String(project.course?.id) === projectCourseFilter)
  const availableFormCourses = formCourses.filter((course) => !(course.project_ids?.length || course.projects?.length))
  const selectedCourseProjects = projectsForCourse(selectedCourse)
  const filteredTasks = tasks.filter((task) => {
    if (taskCourseFilter !== "all" && String(task.course?.id) !== taskCourseFilter) return false
    if (taskProjectFilter !== "all" && String(task.project?.id) !== taskProjectFilter) return false
    if (taskStatusFilter !== "all" && task.status !== taskStatusFilter) return false
    return true
  })

  function describeRequestError(error, fallback) {
    const message = error?.message || fallback
    if (/authentication required|unauthorized|session|sign in/i.test(message)) {
      return "Your session has expired. Sign in again and retry."
    }
    return message
  }

  function projectsForCourse(course) {
    if (!course) return []
    const projectIds = course.project_ids || (course.projects || []).map((project) => project.id)
    if (projectIds.length) {
      const idSet = new Set(projectIds.map(String))
      return projects.filter((project) => idSet.has(String(project.id)))
    }
    return projects.filter((project) => String(project.course?.id) === String(course.id))
  }

  useEffect(() => {
    if (active !== "Tasks") return undefined
    let activeRequest = true
    setLoadingTasks(true)
    setTasksError("")
    listTasks()
      .then((items) => {
        if (activeRequest) setTasks(Array.isArray(items) ? items : [])
      })
      .catch((error) => {
        if (activeRequest) setTasksError(error.message)
      })
      .finally(() => {
        if (activeRequest) setLoadingTasks(false)
      })
    return () => {
      activeRequest = false
    }
  }, [active, data])

  async function loadSubmissionData() {
    const [submissionResponse, gradeResponse] = await Promise.all([
      getInstructorSubmissions(),
      getInstructorGrades(),
    ])
    const items = submissionResponse.submissions || []
    const grades = Array.isArray(gradeResponse.grades) ? gradeResponse.grades : []
    const courseIds = [...new Set(items.map((item) => item.course_id).filter(Boolean))]
    const studentEntries = await Promise.all(
      courseIds.map(async (courseId) => {
        const response = await getInstructorCourseStudents(courseId)
        return [courseId, Array.isArray(response.students) ? response.students : []]
      }),
    )
    return {
      submissions: items,
      grades,
      students: Object.fromEntries(studentEntries),
    }
  }

  async function refreshSubmissionData() {
    const result = await loadSubmissionData()
    setAllSubmissions(result.submissions)
    setSubmissionGrades(result.grades)
    setSubmissionStudents(result.students)
  }

  useEffect(() => {
    if (active !== "Submissions") return undefined
    let activeRequest = true
    setLoadingSubmissions(true)
    setSubmissionsError("")
    loadSubmissionData()
      .then((result) => {
        if (!activeRequest) return
        setAllSubmissions(result.submissions)
        setSubmissionGrades(result.grades)
        setSubmissionStudents(result.students)
      })
      .catch((error) => {
        if (activeRequest) setSubmissionsError(error.message)
      })
      .finally(() => {
        if (activeRequest) setLoadingSubmissions(false)
      })
    return () => {
      activeRequest = false
    }
  }, [active, data])

  useEffect(() => {
    if (active !== "Team Kanban") return
    const coursesWithProjects = courses.filter((course) => course.projects?.length)
    if (coursesWithProjects.length === 0) return
    if (!kanbanCourseId || !coursesWithProjects.some((course) => String(course.id) === kanbanCourseId)) {
      setKanbanCourseId(String(coursesWithProjects[0].id))
      return
    }
    const course = coursesWithProjects.find((item) => String(item.id) === kanbanCourseId)
    if (!kanbanProjectId || !(course.projects || []).some((project) => String(project.id) === kanbanProjectId)) {
      setKanbanProjectId(String(course.projects[0].id))
    }
  }, [active, courses, kanbanCourseId, kanbanProjectId])

  useEffect(() => {
    if (active !== "Team Kanban" || !kanbanProjectId) return undefined
    let activeRequest = true
    setLoadingKanbanTeams(true)
    getInstructorProjectTeams(Number(kanbanProjectId))
      .then((response) => {
        if (activeRequest) setKanbanTeams(Array.isArray(response.teams) ? response.teams : [])
      })
      .catch((error) => {
        if (activeRequest) setTeamBoardError(error.message)
      })
      .finally(() => {
        if (activeRequest) setLoadingKanbanTeams(false)
      })
    return () => {
      activeRequest = false
    }
  }, [active, kanbanProjectId])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)
    localStorage.setItem("team-platform-theme", darkMode ? "dark" : "light")
  }, [darkMode])

  useEffect(() => {
    if (!projectEditor) {
      setFormCourses([])
      setFormCoursesError("")
      setLoadingFormCourses(false)
      return undefined
    }
    let activeRequest = true
    setLoadingFormCourses(true)
    setFormCoursesError("")
    getInstructorCourses()
      .then((response) => {
        if (activeRequest) setFormCourses(Array.isArray(response.courses) ? response.courses : [])
      })
      .catch((error) => {
        if (!activeRequest) return
        const message = describeRequestError(error, "Unable to load your courses.")
        setFormCoursesError(message)
        setProjectError(message)
      })
      .finally(() => {
        if (activeRequest) setLoadingFormCourses(false)
      })
    return () => {
      activeRequest = false
    }
  }, [projectEditor?.id])

  async function refreshDashboard() {
    const refreshed = await getInstructorDashboard()
    setData(refreshed)
    return refreshed
  }

  async function loadCourseDetails(course) {
    setCourseTeams([])
    setCourseStudents([])
    setCourseTeamsError("")
    setCourseStudentsError("")
    setLoadingCourseTeams(true)
    setLoadingCourseStudents(true)
    const courseProjects = course.projects || []
    const projectIds = Array.from(new Set(course.project_ids || courseProjects.map((project) => project.id)))
    const requests = [getInstructorCourseStudents(course.id), ...projectIds.map((projectId) => getInstructorProjectTeams(projectId))]
    try {
      const [studentResponse, ...teamResponses] = await Promise.all(requests)
      setCourseStudents(studentResponse.students || [])
      setCourseTeams(
        teamResponses.flatMap((response, index) => {
          const projectId = projectIds[index]
          const projectTitle = courseProjects.find((project) => project.id === projectId)?.title || projects.find((project) => project.id === projectId)?.title || `Project ${projectId}`
          return (response.teams || []).map((team) => ({ ...team, project_id: projectId, project_title: projectTitle }))
        }),
      )
    } catch (error) {
      setCourseStudentsError(error.message)
      if (projectIds.length) setCourseTeamsError(error.message)
    } finally {
      setLoadingCourseStudents(false)
      setLoadingCourseTeams(false)
    }
  }

  async function openCourse(course) {
    setSelectedCourse(course)
    setCourseStudentsVisible(false)
    setProjectFileError("")
    setActive("Course details")
    await loadCourseDetails(course)
  }

  async function viewCourseStudents(course) {
    setSelectedCourse(course)
    setCourseStudentsVisible(true)
    setProjectFileError("")
    setActive("Course details")
    await loadCourseDetails(course)
  }

  async function openTaskById(taskId) {
    try {
      const found = tasks.find((task) => task.id === taskId)
      const loaded = found || (await listTasks())
      const task = Array.isArray(loaded) ? loaded.find((item) => item.id === taskId) : loaded
      if (task) setSelectedTask(task)
    } catch (error) {
      setTasksError(error.message)
      setActive("Tasks")
    }
  }

  async function loadTeamBoard(teamId, projectId) {
    if (!teamId) return null
    setTeamBoardLoading(true)
    setTeamBoardError("")
    try {
      const board = await getInstructorTeamKanban(teamId, projectId)
      setSelectedTeamBoard(board)
      setSelectedTeamId(teamId)
      setSelectedTeamProjectId(projectId)
      return board
    } catch (error) {
      setSelectedTeamBoard(null)
      setTeamBoardError(describeRequestError(error, "Unable to load the team board."))
      return null
    } finally {
      setTeamBoardLoading(false)
    }
  }

  async function openTeamBoard(team, projectId) {
    setActive("Team Kanban")
    setNotice("")
    await loadTeamBoard(team.id, projectId)
  }

  async function refreshTeamBoard() {
    if (!selectedTeamId) return
    await loadTeamBoard(selectedTeamId, selectedTeamProjectId)
  }

  async function handleSaveAccount({ email, currentPassword }) {
    await updateAccountInfo({ email, currentPassword })
    setData((current) => ({
      ...current,
      instructor: { ...current.instructor, email },
    }))
  }

  function previewSubmission(submission) {
    setPreviewFile({
      submission,
      path: instructorSubmissionFileUrl(submission.id),
      title: `${submission.team_name || "Team"} · ${submission.project_title || "Submission"}`,
      fileName: submission.file?.original_name || "submission",
      downloadPath: instructorSubmissionFileUrl(submission.id, true),
    })
  }

  async function downloadSubmission(submission) {
    try {
      const { blob } = await fetchInstructorFile(
        instructorSubmissionFileUrl(submission.id, true),
        "Unable to download submission.",
      )
      saveFileBlob(blob, submission.file?.original_name || "submission")
    } catch (error) {
      setSubmissionsError(error.message)
    }
  }

  function openProjectEditor(project = null, courseId = "") {
    setProjectError("")
    setProjectEditor({
      id: project?.id ?? null,
      courseId: project?.course?.id ?? (courseId === "" ? "" : Number(courseId)),
      title: project?.title ?? "",
      description: project?.description ?? "",
      status: project?.status ?? "todo",
      min_members_per_team: project?.min_members_per_team ?? 2,
      max_members_per_team: project?.max_members_per_team ?? 5,
      deadline: toDateTimeInput(project?.deadline),
      requirementsName: project?.requirements?.original_name ?? "",
      requirementsFile: null,
    })
  }

  async function saveProject(event) {
    event.preventDefault()
    setProjectError("")
    setNotice("")
    const { id, courseId, requirementsFile, requirementsName, ...fields } = projectEditor
    const minMembers = Number(fields.min_members_per_team)
    const maxMembers = Number(fields.max_members_per_team)
    const selectedCourseInfo = availableFormCourses.find((course) => String(course.id) === String(courseId))

    if (!fields.title.trim()) {
      setProjectError("Project title is required.")
      return
    }
    if (!["todo", "in_progress", "review", "done"].includes(fields.status)) {
      setProjectError("Select a valid project status.")
      return
    }
    if (!id) {
      if (loadingFormCourses) {
        setProjectError("Courses are still loading. Please wait and try again.")
        return
      }
      if (formCoursesError) {
        setProjectError(formCoursesError)
        return
      }
      if (availableFormCourses.length === 0) {
        setProjectError("Every course already has a project. Each course can have only one project.")
        return
      }
      if (!courseId || !selectedCourseInfo) {
        setProjectError("Select a valid course from your courses.")
        return
      }
    }
    if (!Number.isInteger(minMembers) || minMembers < 1) {
      setProjectError("Minimum team size must be at least 1.")
      return
    }
    if (!Number.isInteger(maxMembers) || maxMembers < minMembers) {
      setProjectError("Maximum team size must be greater than or equal to minimum team size.")
      return
    }
    if (!id && !requirementsFile && !requirementsName) {
      setProjectError("Upload the project requirements PDF.")
      return
    }

    setSavingProject(true)
    const payload = {
      ...fields,
      course_id: courseId === "" ? null : Number(courseId),
      title: fields.title.trim(),
      min_members_per_team: minMembers,
      max_members_per_team: maxMembers,
      deadline: toUtcIsoString(fields.deadline),
    }
    let savedProjectId = id
    try {
      if (id) {
        await updateInstructorProject(id, payload)
      } else {
        const response = await createCourseProject(courseId, payload)
        savedProjectId = response.project.id
      }
      if (requirementsFile) {
        await uploadInstructorProjectRequirements(savedProjectId, requirementsFile)
      }
      const refreshed = await refreshDashboard()
      if (selectedCourse) {
        const refreshedCourse = refreshed.courses.find((course) => course.id === selectedCourse.id) || selectedCourse
        setSelectedCourse(refreshedCourse)
        await loadCourseDetails(refreshedCourse)
      }
      setProjectEditor(null)
      setNotice(id ? "Project updated successfully." : "Project added successfully.")
    } catch (error) {
      if (savedProjectId && !id) {
        setProjectEditor({ ...projectEditor, id: savedProjectId })
        const refreshed = await refreshDashboard().catch(() => null)
        if (refreshed) {
          const refreshedCourse = refreshed.courses.find((course) => course.id === Number(courseId))
          if (refreshedCourse) setSelectedCourse(refreshedCourse)
        }
      }
      setProjectError(describeRequestError(error, "Unable to save the project."))
    } finally {
      setSavingProject(false)
    }
  }

  async function deleteProject() {
    if (!projectEditor?.id) return
    const confirmed = window.confirm(
      "Delete this project? Its teams, tasks, submissions, grades, and peer feedback will also be deleted. This cannot be undone.",
    )
    if (!confirmed) return

    setSavingProject(true)
    setProjectError("")
    try {
      await deleteInstructorProject(projectEditor.id)
      const refreshed = await refreshDashboard()
      if (selectedCourse) {
        const refreshedCourse = refreshed.courses.find((course) => course.id === selectedCourse.id) || selectedCourse
        setSelectedCourse(refreshedCourse)
        await loadCourseDetails(refreshedCourse)
      }
      setProjectEditor(null)
      setNotice("Project deleted successfully.")
    } catch (error) {
      setProjectError(error.message)
    } finally {
      setSavingProject(false)
    }
  }

  async function syncMicrosoftClasses() {
    setSyncingMicrosoftCourses(true)
    setMicrosoftSyncMessage("")
    setMicrosoftSyncError("")
    try {
      const result = await syncMicrosoftCourses()
      const refreshed = await getInstructorDashboard()
      setData(refreshed)
      setMicrosoftSyncMessage(
        `Synced ${result.classes_added} new classes, updated ${result.classes_updated}, and enrolled ${result.enrollments_added} students.`,
      )
    } catch (error) {
      setMicrosoftSyncError(error.message)
    } finally {
      setSyncingMicrosoftCourses(false)
    }
  }

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="theme-page min-h-screen bg-[#f5faf9] text-[#183f43] transition-colors duration-300">
        <Sidebar
          active={active}
          onSelect={(page) => {
            setActive(page)
            setNotice("")
          }}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
          instructor={instructor}
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
                Instructor portal
              </div>
              <div className="truncate text-lg font-bold text-[#003C43]">
                {active}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
                  {`${instructor.first_name[0]}${instructor.last_name[0]}`}
                </div>
                <div className="hidden xl:block">
                  <div className="text-xs font-bold text-[#003C43]">
                    {instructor.full_name}
                  </div>
                  <div className="text-[10px] text-[#6d898b]">
                    {instructor.email}
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
            {notice && (
              <p className="mb-5 rounded-xl border border-[#135D66]/15 bg-[#E3FEF7] px-4 py-3 text-sm font-semibold text-[#135D66]" role="status">
                {notice}
              </p>
            )}
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
                    Welcome, {instructor.first_name}.
                  </h1>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">
                    You have {courses.length} courses,{" "}
                    {projects.reduce((count, project) => count + project.team_count, 0)}{" "}
                    project teams, and {submissions.items.length} submissions available.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setActive("Courses")} className="theme-invert flex w-fit items-center gap-2 rounded-xl bg-[#E3FEF7] px-4 py-2.5 text-xs font-bold text-[#003C43] transition hover:bg-white">
                    View courses <Icon name="arrow" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>

            {progress && (
              <section className="mt-8">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#003C43]">
                      Progress overview
                    </h2>
                    <p className="mt-1 text-xs text-[#6d898b]">
                      At-a-glance course and task progress
                    </p>
                  </div>
                  <button onClick={() => setActive("Progress Dashboard")} className="flex items-center gap-1 text-xs font-bold text-[#135D66] transition hover:text-[#003C43]">
                    View details <Icon name="chevron" className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Active courses", value: progress.overall?.course_count ?? courses.length },
                    { label: "Total students", value: progress.overall?.student_count ?? students.length },
                    { label: "Team progress", value: `${progress.overall?.team_count ?? 0} teams` },
                    { label: "Task progress", value: `${progress.overall?.completion_percent ?? 0}% complete` },
                  ].map((stat) => (
                    <article key={stat.label} className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77B0AA]">{stat.label}</div>
                      <div className="mt-2 text-2xl font-extrabold text-[#003C43]">{stat.value}</div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[#003C43]">
                    My courses
                  </h2>
                  <p className="mt-1 text-xs text-[#6d898b]">
                    {courses[0]
                      ? `${courses[0].semester} semester · ${courses[0].academic_year}`
                      : "Your assigned courses"}
                  </p>
                </div>
                <button onClick={() => setActive("Courses")} className="flex items-center gap-1 text-xs font-bold text-[#135D66] transition hover:text-[#003C43]">
                  View all <Icon name="chevron" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-3">
                {courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onOpen={() => openCourse(course)}
                    onViewStudents={() => viewCourseStudents(course)}
                  />
                ))}
                {courses.length === 0 && (
              <p className="text-xs text-[#6d898b]">No courses are assigned to your account.</p>
                )}
              </div>
            </section>

            <div className="mt-7 grid items-stretch gap-6 lg:grid-cols-2">
              <section className="theme-surface h-full rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] transition-colors sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#003C43]">
                      Project deadlines
                    </h2>
                    <p className="mt-1 text-xs text-[#7b9294]">
                      Upcoming milestones across your courses
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
                          {item.course.name} · {item.team.name}
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
                        onClick={() => openTaskById(item.id)}
                      >
                        <Icon name="chevron" className="h-4 w-4" />
                      </button>
                    </article>
                    )
                  })}
                  {deadlines.length === 0 && (
                    <p className="py-4 text-xs text-[#6d898b]">No upcoming project deadlines.</p>
                  )}
                </div>
              </section>

              <section className="theme-surface h-full rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] transition-colors sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#003C43]">
                      Submissions to review
                    </h2>
                    <p className="mt-1 text-xs text-[#7b9294]">
                      Give feedback and grade student work
                    </p>
                  </div>
                  <button onClick={() => setActive("Submissions")} className="rounded-full bg-[#E3FEF7] px-2.5 py-1 text-[10px] font-bold text-[#135D66]">
                    {recentSubmissions.length} recent
                  </button>
                </div>
                <div className="divide-y divide-[#003C43]/7">
                  {recentSubmissions.map((submission) => (
                    <article
                      key={submission.id}
                      className="flex items-center gap-3 py-4 first:pt-1 last:pb-0"
                    >
                      <div className="theme-invert grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#77B0AA] text-xs font-extrabold text-[#003C43]">
                        {(submission.team_name || "T").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-[#18484d]">
                          {submission.team_name || "Team"}
                        </div>
                        <div className="mt-1 truncate text-[10px] text-[#718b8d]">
                          {submission.project_title || "Project"} · {submission.course_name || "Course"}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-[#77B0AA]">
                          <span>{submission.submitter_name || "Unknown"}</span>
                          <span className="h-1 w-1 rounded-full bg-[#77B0AA]" />
                          <span className={submission.status === "late" ? "text-[#b66b4d]" : ""}>
                            {submission.status.replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => previewSubmission(submission)}
                        className="rounded-lg bg-[#E3FEF7] px-3 py-2 text-[10px] font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43]"
                      >
                        Preview
                      </button>
                    </article>
                  ))}
                  {recentSubmissions.length === 0 && (
                    <p className="py-4 text-xs text-[#6d898b]">
                      {submissions?.available ? "No submissions to review." : submissions?.reason}
                    </p>
                  )}
                </div>
              </section>
            </div>
              </>
            ) : active === "Course details" && selectedCourse ? (
              <section className="space-y-6">
                <button onClick={() => setActive("Courses")} className="text-xs font-bold text-[#135D66] hover:text-[#003C43]">← Back to courses</button>
                <div className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77B0AA]">{selectedCourse.code || "Course"} · {selectedCourse.semester} {selectedCourse.academic_year}</p><h1 className="mt-1 text-2xl font-bold text-[#003C43]">{selectedCourse.name}</h1><p className="mt-2 text-xs text-[#6d898b]">{selectedCourse.student_count} enrolled students</p></div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedCourseProjects.length === 0 ? (
                        <button onClick={() => openProjectEditor(null, selectedCourse.id)} className="rounded-xl bg-[#135D66] px-4 py-2.5 text-xs font-bold text-white">Create project</button>
                      ) : (
                        <span className="theme-soft rounded-xl px-4 py-2.5 text-xs font-bold text-[#135D66]">Each course has one project</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-5">
                    <h2 className="text-sm font-bold text-[#003C43]">Projects in this course ({selectedCourseProjects.length})</h2>
                    {selectedCourseProjects.length ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {selectedCourseProjects.map((project) => (
                          <article key={project.id} className="rounded-xl bg-[#f0f7f6] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-bold text-[#003C43]">{project.title || "Untitled project"}</h3>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusTone(project.status || "todo")}`}>{String(project.status || "todo").replaceAll("_", " ")}</span>
                                </div>
                                <p className="mt-1 text-xs text-[#587376]">Teams of {project.min_members_per_team}–{project.max_members_per_team} · {project.team_count} teams · {formatDate(project.deadline)}</p>
                              </div>
                              <button type="button" onClick={() => openProjectEditor(project)} className="rounded-lg bg-[#135D66] px-3 py-2 text-[11px] font-bold text-white">Manage</button>
                            </div>
                            {project.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#365c60]">{project.description}</p>}
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              {project.requirements ? (
                                <>
                                  <span className="text-sm font-semibold text-[#365c60]">Requirements: {project.requirements.original_name}</span>
                                  <button type="button" onClick={() => setPdfProject(project)} className="rounded-lg border border-[#135D66]/20 px-3 py-2 text-xs font-bold text-[#135D66]">Preview file</button>
                                  <button type="button" onClick={async () => { setProjectFileError(""); try { await downloadInstructorProjectRequirements(project.id, project.requirements.original_name) } catch (error) { setProjectFileError(error.message) } }} className="rounded-lg border border-[#135D66]/20 px-3 py-2 text-xs font-bold text-[#135D66]">Download file</button>
                                </>
                              ) : <span className="text-sm text-[#718b8d]">No requirements file uploaded yet.</span>}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : <p className="mt-3 rounded-xl bg-[#f0f7f6] p-4 text-sm text-[#587376]">No project has been added to this course yet. Create one and attach its requirements file.</p>}
                    {projectFileError && <p className="mt-2 text-xs text-[#a94646]" role="alert">{projectFileError}</p>}
                  </div>
                </div>
                <div className={`theme-surface rounded-2xl border bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6 ${courseStudentsVisible ? "border-[#77B0AA] ring-2 ring-[#77B0AA]/20" : "border-[#003C43]/8"}`}>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-[#003C43]">Students in this course</h2>
                      <p className="mt-1 text-xs text-[#6d898b]">Loaded with course ID {selectedCourse.id}; students from other courses are excluded.</p>
                    </div>
                    <button type="button" onClick={() => loadCourseDetails(selectedCourse)} className="rounded-lg border border-[#135D66]/20 px-3 py-2 text-xs font-bold text-[#135D66]">Refresh</button>
                  </div>
                  {loadingCourseStudents ? <p className="mt-4 text-sm text-[#6d898b]">Loading students…</p> : courseStudentsError ? <p className="mt-4 text-sm text-[#a94646]" role="alert">{courseStudentsError}</p> : courseStudents.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{courseStudents.map((student) => <StudentCard key={student.id} student={student} onClick={() => setStudentProfileId(student.id)} />)}</div> : <p className="mt-4 rounded-xl bg-[#f0f7f6] p-4 text-sm text-[#587376]">No students are enrolled in this course.</p>}
                </div>
                <div className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                  <h2 className="text-lg font-bold text-[#003C43]">Project teams</h2>
                  <p className="mt-1 text-xs text-[#6d898b]">Teams and enrolled members across all projects in this course</p>
                  {loadingCourseTeams ? <p className="mt-4 text-sm text-[#6d898b]">Loading teams…</p> : courseTeamsError ? <p className="mt-4 text-sm text-[#a94646]" role="alert">{courseTeamsError}</p> : courseTeams.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{courseTeams.map((team) => <article key={team.id} className="rounded-xl border border-[#003C43]/10 bg-[#f7fbfa] p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-bold text-[#003C43]">{team.name}</h3><span className="rounded-full bg-[#E3FEF7] px-2 py-1 text-[10px] font-bold text-[#135D66]">{team.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#135D66]">{team.project_title || `Project ${team.project_id}`}</p><p className="mt-1 text-xs text-[#6d898b]">{team.member_count} {team.member_count === 1 ? "member" : "members"}</p><ul className="mt-3 space-y-1.5">{team.members.map((member) => <li key={member.student_id} className="text-sm text-[#365c60]">{member.name}{member.student_id === team.leader_id ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-[#77B0AA]">Leader</span> : null}</li>)}</ul><button type="button" onClick={() => openTeamBoard(team, team.project_id)} className="mt-4 rounded-lg bg-[#135D66] px-3 py-2 text-[11px] font-bold text-white">Open board</button></article>
)}</div> : <p className="mt-4 rounded-xl bg-[#f0f7f6] p-4 text-sm text-[#587376]">{selectedCourseProjects.length ? "No teams have joined these projects yet." : "Teams will appear here after a project is created and students form teams."}</p>}
                </div>
                <GradeManagement courses={courses} projects={projects} initialCourseId={selectedCourse.id} />
              </section>
            ) : active === "Courses" ? (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-bold text-[#003C43]">My courses</h1><button type="button" onClick={syncMicrosoftClasses} disabled={syncingMicrosoftCourses} className="rounded-xl bg-[#135D66] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{syncingMicrosoftCourses ? "Syncing Microsoft classes…" : "Sync Microsoft classes"}</button></div>
                {microsoftSyncError && <p className="mt-3 text-sm text-[#a94646]" role="alert">{microsoftSyncError}</p>}
                {microsoftSyncMessage && <p className="mt-3 text-sm text-[#135D66]" role="status">{microsoftSyncMessage}</p>}
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {courses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onOpen={() => openCourse(course)}
                      onViewStudents={() => viewCourseStudents(course)}
                    />
                  ))}
                </div>
                {courses.length === 0 && <p className="mt-4 text-xs text-[#6d898b]">No courses are assigned to your account.</p>}
              </section>
            ) : active === "Students" ? (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-[#003C43]">Students</h1>
                    <p className="mt-1 text-xs text-[#6d898b]">All students enrolled in your courses. Select a student for the full profile.</p>
                  </div>
                  <span className="rounded-full bg-[#E3FEF7] px-3 py-1 text-[10px] font-bold text-[#135D66]">{visibleStudents.length} shown</span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleStudents.map((student) => <StudentCard key={student.id} student={student} onClick={() => setStudentProfileId(student.id)} />)}
                </div>
                {visibleStudents.length === 0 && <p className="mt-4 text-xs text-[#6d898b]">No enrolled students match the current search.</p>}
              </section>
            ) : active === "Tasks" ? (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-[#003C43]">Tasks</h1>
                    <p className="mt-1 text-xs text-[#6d898b]">View team tasks and provide feedback. Students manage their own tasks.</p>
                  </div>
                  <span className="rounded-full bg-[#E3FEF7] px-3 py-1 text-[10px] font-bold text-[#135D66]">Read only</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold text-[#365c60]">Course
                    <select value={taskCourseFilter} onChange={(event) => { setTaskCourseFilter(event.target.value); setTaskProjectFilter("all") }} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm">
                      <option value="all">All courses</option>
                      {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[#365c60]">Project
                    <select value={taskProjectFilter} onChange={(event) => setTaskProjectFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm">
                      <option value="all">All projects</option>
                      {(taskCourseFilter === "all" ? projects : projects.filter((project) => String(project.course?.id) === taskCourseFilter)).map((project) => <option key={project.id} value={project.id}>{project.title || `Project ${project.id}`}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[#365c60]">Status
                    <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm">
                      <option value="all">All statuses</option>
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </label>
                </div>
                {loadingTasks ? <p className="mt-5 text-sm text-[#6d898b]">Loading tasks…</p> : tasksError ? <p className="mt-5 text-sm text-[#a94646]" role="alert">{tasksError}</p> : filteredTasks.length ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
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
                        {filteredTasks.map((task) => (
                          <tr key={task.id}>
                            <td className="py-3 pr-4"><div className="font-bold text-[#003C43]">{task.title}</div><div className="text-[10px] text-[#718b8d]">{task.team?.name || "No team"}</div></td>
                            <td className="py-3 pr-4 text-xs text-[#587376]"><div>{task.course?.name || "—"}</div><div className="text-[10px]">{task.project?.title || "—"}</div></td>
                            <td className="py-3 pr-4 text-xs text-[#587376]">{task.assignee?.name || <span className="italic text-[#718b8d]">Unassigned</span>}</td>
                            <td className="py-3 pr-4"><span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${statusTone(task.status)}`}>{task.status.replaceAll("_", " ")}</span></td>
                            <td className="py-3 pr-4 text-xs text-[#587376]">{formatDate(task.due_date)}</td>
                            <td className="py-3 pr-4 text-[10px] text-[#718b8d]">{task.comment_count || 0} comments · {task.attachment_count || 0} files</td>
                            <td className="py-3"><button type="button" onClick={() => setSelectedTask(task)} className="rounded-lg bg-[#E3FEF7] px-3 py-2 text-[10px] font-bold text-[#135D66]">Open</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="mt-5 rounded-xl bg-[#f0f7f6] p-4 text-sm text-[#587376]">No tasks match the current filters.</p>}
              </section>
            ) : active === "Progress Dashboard" ? (
              <section className="space-y-6">
                <div className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                  <h1 className="text-xl font-bold text-[#003C43]">Progress Dashboard</h1>
                  <p className="mt-1 text-xs text-[#6d898b]">Live task, submission, GPA, and team-risk metrics from your courses and projects.</p>
                </div>
                <ProgressCharts progress={progress} />
              </section>
            ) : active === "Team Kanban" ? (
              <section className="space-y-5">
                <div className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                  <h1 className="text-xl font-bold text-[#003C43]">Team Kanban</h1>
                  <p className="mt-1 text-xs text-[#6d898b]">
                    Choose a project team to review its board and record individual grades.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-[#365c60]">Course
                      <select
                        value={kanbanCourseId}
                        onChange={(event) => {
                          setKanbanCourseId(event.target.value)
                          setKanbanProjectId("")
                          setKanbanTeams([])
                          setSelectedTeamBoard(null)
                        }}
                        className="theme-control mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm"
                      >
                        <option value="">Select course</option>
                        {courses.filter((course) => course.projects?.length).map((course) => (
                          <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-[#365c60]">Project
                      <select
                        value={kanbanProjectId}
                        onChange={(event) => {
                          setKanbanProjectId(event.target.value)
                          setKanbanTeams([])
                          setSelectedTeamBoard(null)
                        }}
                        className="theme-control mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm"
                      >
                        <option value="">Select project</option>
                        {(courses.find((course) => String(course.id) === kanbanCourseId)?.projects || []).map((project) => (
                          <option key={project.id} value={project.id}>{project.title}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-[#365c60]">Team
                      <select
                        value={selectedTeamId || ""}
                        onChange={(event) => loadTeamBoard(Number(event.target.value), Number(kanbanProjectId))}
                        className="theme-control mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm"
                      >
                        <option value="">Select team</option>
                        {kanbanTeams.map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {loadingKanbanTeams && <p className="mt-3 text-xs text-[#6d898b]">Loading teams…</p>}
                </div>
                {teamBoardError && <p className="rounded-xl bg-[#fff0f0] p-4 text-xs text-[#a94646]" role="alert">{teamBoardError}</p>}
                {teamBoardLoading && <p className="text-xs text-[#6d898b]" role="status">Loading team board…</p>}
                {selectedTeamBoard && (
                  <InstructorTeamKanban
                    board={selectedTeamBoard}
                    onOpenTask={setSelectedTask}
                    onRefresh={refreshTeamBoard}
                    refreshing={teamBoardLoading}
                  />
                )}
              </section>
            ) : active === "Grades" ? (
              <GradeManagement courses={courses} projects={projects} />
            ) : active === "Submissions" ? (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-[#003C43]">Submissions</h1>
                    <p className="mt-1 text-xs text-[#6d898b]">Preview or download files submitted by your teams.</p>
                  </div>
                  <span className="rounded-full bg-[#E3FEF7] px-3 py-1 text-[10px] font-bold text-[#135D66]">{allSubmissions.length} total</span>
                </div>
                <div className="mt-5">
                  {loadingSubmissions ? <p className="text-sm text-[#6d898b]">Loading submissions…</p> : submissionsError ? <p className="text-sm text-[#a94646]" role="alert">{submissionsError}</p> : <SubmissionTimeline submissions={allSubmissions} onView={previewSubmission} onDownload={downloadSubmission} onOpen={previewSubmission} renderGradeEditor={(submission) => <SubmissionGradeEditor submission={submission} students={submissionStudents[submission.course_id] || []} grade={submissionGrades.find((grade) => String(grade.student_id) === String(submission.submitted_by) && String(grade.project_id) === String(submission.project_id)) || null} maxGrade={Number(projects.find((project) => String(project.id) === String(submission.project_id))?.max_grade) || 100} onSaved={refreshSubmissionData} />} />}
                </div>
              </section>
            ) : active === "Settings" ? (
              <SettingsPage
                account={instructor}
                accountType="instructor"
                onSaveAccount={handleSaveAccount}
                onRequestPasswordReset={onRequestPasswordReset}
              />
            ) : (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 text-sm text-[#6d898b]">
                This page is not available.
              </section>
            )}
            {projectEditor && (
              <div className="fixed inset-0 z-[80] grid place-items-center bg-[#003C43]/50 p-4" role="presentation">
                <form onSubmit={saveProject} className="theme-surface max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[#003C43]">{projectEditor.id ? "Edit project" : "Add project to a course"}</h2><button type="button" onClick={() => setProjectEditor(null)} className="text-sm text-[#587376]">Close</button></div>
                  {!projectEditor.id && (
                    <label className="block text-xs font-semibold text-[#365c60]">
                      Course
                      <select
                        required
                        value={projectEditor.courseId}
                        onChange={(event) => setProjectEditor({ ...projectEditor, courseId: event.target.value ? Number(event.target.value) : "" })}
                        className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm"
                      >
                        <option value="">{loadingFormCourses ? "Loading courses…" : availableFormCourses.length ? "Select a course" : "No courses available"}</option>
                        {formCourses.map((course) => {
                          const hasProject = Boolean(course.project_ids?.length || course.projects?.length)
                          return (
                            <option key={course.id} value={course.id} disabled={hasProject}>
                              {course.name}{course.code ? ` (${course.code})` : ""}{hasProject ? " — project already added" : ""}
                            </option>
                          )
                        })}
                      </select>
                      <span className="mt-1 block font-normal text-[#718b8d]">
                        {loadingFormCourses
                          ? "Loading courses assigned to your account…"
                          : formCoursesError
                            ? formCoursesError
                            : availableFormCourses.length === 0
                              ? "Every course already has a project. Each course can have only one project."
                              : `${availableFormCourses.length} course${availableFormCourses.length === 1 ? "" : "s"} available. Each course can have only one project.`}
                      </span>
                    </label>
                  )}
                  <label className="block text-xs font-semibold text-[#365c60]">Project title<input value={projectEditor.title} onChange={(e) => setProjectEditor({ ...projectEditor, title: e.target.value })} className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm" /></label>
                  <label className="block text-xs font-semibold text-[#365c60]">Description<textarea value={projectEditor.description} onChange={(e) => setProjectEditor({ ...projectEditor, description: e.target.value })} rows="3" className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm" /></label>
                  <label className="block text-xs font-semibold text-[#365c60]">Status<select value={projectEditor.status} onChange={(e) => setProjectEditor({ ...projectEditor, status: e.target.value })} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="review">Review</option><option value="done">Done</option></select></label>
                  <label className="block text-xs font-semibold text-[#365c60]">Project requirements file<input type="file" accept=".pdf,application/pdf" required={!projectEditor.requirementsName} onChange={(e) => setProjectEditor({ ...projectEditor, requirementsFile: e.target.files?.[0] || null })} className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm" /><span className="mt-1 block font-normal text-[#718b8d]">Upload a PDF file.{projectEditor.requirementsFile ? ` Selected: ${projectEditor.requirementsFile.name}` : projectEditor.requirementsName ? ` Current file: ${projectEditor.requirementsName}` : " Required for this project."}</span></label>
                  <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-[#365c60]">Min team size<input type="number" min="1" required value={projectEditor.min_members_per_team} onChange={(e) => setProjectEditor({ ...projectEditor, min_members_per_team: e.target.value })} className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm" /></label><label className="text-xs font-semibold text-[#365c60]">Max team size<input type="number" min="1" required value={projectEditor.max_members_per_team} onChange={(e) => setProjectEditor({ ...projectEditor, max_members_per_team: e.target.value })} className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm" /></label><label className="text-xs font-semibold text-[#365c60]">Deadline<input type="datetime-local" value={projectEditor.deadline} onChange={(e) => setProjectEditor({ ...projectEditor, deadline: e.target.value })} className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm" /></label></div>
                  {projectError && <p className="text-sm text-[#a94646]" role="alert">{projectError}</p>}
                  <div className="flex justify-between gap-2">{projectEditor.id && <button type="button" disabled={savingProject} onClick={deleteProject} className="mr-auto rounded-lg border border-[#a94646]/25 px-4 py-2 text-sm font-semibold text-[#a94646] disabled:opacity-60">Delete project</button>}<button type="button" onClick={() => setProjectEditor(null)} className="rounded-lg border border-[#003C43]/15 px-4 py-2 text-sm">Cancel</button><button disabled={savingProject || (!projectEditor.id && (loadingFormCourses || Boolean(formCoursesError) || availableFormCourses.length === 0))} className="rounded-lg bg-[#135D66] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{savingProject ? "Saving…" : "Save project"}</button></div>
                </form>
              </div>
            )}
            {selectedTask && (
              <TaskDetailsModal
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                canManage={false}
                canUpdateStatus={true}
                viewerRole="instructor"
                currentUserId={instructor?.id}
                onTaskUpdated={(updated) => {
                  setSelectedTask(updated)
                  setTasks((items) => items.map((item) => (item.id === updated.id ? updated : item)))
                  setNotice("Task feedback saved.")
                }}
              />
            )}
            {studentProfileId && (
              <StudentProfileModal
                studentId={studentProfileId}
                onClose={() => setStudentProfileId(null)}
              />
            )}
            {pdfProject && (
              <PdfPreview project={pdfProject} onClose={() => setPdfProject(null)} />
            )}
            {previewFile && (
              <FilePreviewModal
                path={previewFile.path}
                title={previewFile.title}
                fileName={previewFile.fileName}
                onClose={() => setPreviewFile(null)}
                onDownload={() => {
                  if (previewFile.submission) downloadSubmission(previewFile.submission)
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
