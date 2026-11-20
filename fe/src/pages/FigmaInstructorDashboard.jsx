import { useState } from "react"

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
  { label: "My courses", icon: "book" },
  { label: "Students", icon: "users" },
  { label: "Projects", icon: "file" },
  { label: "Resources", icon: "calendar" },
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

function CourseCard({ course }) {
  return (
    <article className="theme-surface group flex min-w-[270px] flex-1 flex-col rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.05)] transition hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(0,60,67,0.10)]">
      <div className="flex items-start justify-between">
        <div
          className="theme-icon grid h-11 w-11 place-items-center rounded-xl bg-[#E3FEF7] text-sm font-extrabold text-[#003C43]"
        >
          {(course.code || course.name).slice(0, 2).toUpperCase()}
        </div>
        <button
          className="grid h-8 w-8 place-items-center rounded-lg text-[#77B0AA] transition group-hover:bg-[#E3FEF7] group-hover:text-[#003C43]"
          aria-label={`Open ${course.name}`}
        >
          <Icon name="arrow" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#77B0AA]">
        {course.code}
      </div>
      <h3 className="mt-1 min-h-12 text-[17px] font-bold leading-6 text-[#003C43]">
        {course.name}
      </h3>
      <div className="mt-4 border-t border-[#003C43]/7 pt-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#003C43]">
            <Icon name="users" className="h-3.5 w-3.5 text-[#77B0AA]" />
            {course.student_count}
          </div>
          <div className="mt-0.5 text-[9px] text-[#718b8d]">Students</div>
        </div>
      </div>
    </article>
  )
}

export default function FigmaInstructorDashboard({ dashboard, onLogout }) {
  const [active, setActive] = useState("Overview")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const { instructor, courses, deadlines, students, projects, submissions, resources } = dashboard

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
              <div
                className={`${
                  searchOpen ? "flex" : "hidden"
                } theme-control absolute left-4 right-4 top-[82px] items-center rounded-xl border border-[#003C43]/10 bg-white px-3 shadow-xl sm:static sm:flex sm:w-60 sm:shadow-none`}
              >
                <Icon name="search" className="h-4 w-4 text-[#77B0AA]" />
                <input
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
                  <button disabled title="Course resource uploads are not available yet" className="flex w-fit cursor-not-allowed items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white opacity-60">
                    <Icon name="file" className="h-4 w-4" />
                    Upload slides or lab
                  </button>
                  <button disabled title="Project creation is not available yet" className="theme-invert flex w-fit cursor-not-allowed items-center gap-2 rounded-xl bg-[#E3FEF7] px-4 py-2.5 text-xs font-bold text-[#003C43] opacity-60">
                    Create new project <Icon name="arrow" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>

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
                <button onClick={() => setActive("My courses")} className="flex items-center gap-1 text-xs font-bold text-[#135D66] transition hover:text-[#003C43]">
                  View all <Icon name="chevron" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-3">
                {courses.map((course) => (
                  <CourseCard key={course.name} course={course} />
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
                  <span className="rounded-full bg-[#E3FEF7] px-2.5 py-1 text-[10px] font-bold text-[#135D66]">
                    {submissions.items.length} new
                  </span>
                </div>
                <div className="divide-y divide-[#003C43]/7">
                  {submissions.items.map((submission) => (
                    <article
                      key={submission.id}
                      className="flex items-center gap-3 py-4 first:pt-1 last:pb-0"
                    >
                      <div className="theme-invert grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#77B0AA] text-xs font-extrabold text-[#003C43]">
                        {submission.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-[#18484d]">
                          {submission.name}
                        </div>
                        <div className="mt-1 truncate text-[10px] text-[#718b8d]">
                          {submission.assignment} · {submission.course}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-[#77B0AA]">
                          <span>{submission.submitted}</span>
                          <span className="h-1 w-1 rounded-full bg-[#77B0AA]" />
                          <span
                            className={
                              submission.status === "Late"
                                ? "text-[#b66b4d]"
                                : ""
                            }
                          >
                            {submission.status}
                          </span>
                        </div>
                      </div>
                      <button className="rounded-lg bg-[#E3FEF7] px-3 py-2 text-[10px] font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43]">
                        Review
                      </button>
                    </article>
                  ))}
                  {submissions.items.length === 0 && (
                    <p className="py-4 text-xs text-[#6d898b]">
                      {submissions.available ? "No submissions to review." : submissions.reason}
                    </p>
                  )}
                </div>
              </section>
            </div>
              </>
            ) : active === "My courses" ? (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <h1 className="text-xl font-bold text-[#003C43]">My courses</h1>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {courses.map((course) => (
                    <article key={course.id} className="theme-surface rounded-xl bg-[#f0f7f6] p-4">
                      <h2 className="font-bold text-[#003C43]">{course.name}</h2>
                      <p className="mt-1 text-xs text-[#6d898b]">{course.code || "Course code unavailable"}</p>
                      <p className="mt-3 text-xs text-[#587376]">{course.student_count} enrolled students</p>
                    </article>
                  ))}
                </div>
                {courses.length === 0 && <p className="mt-4 text-xs text-[#6d898b]">No courses are assigned to your account.</p>}
              </section>
            ) : active === "Students" ? (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <h1 className="text-xl font-bold text-[#003C43]">Students</h1>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {students.map((student) => (
                    <article key={student.id} className="theme-surface rounded-xl border border-[#003C43]/10 bg-white p-4 shadow-sm">
                      <h2 className="font-bold text-[#003C43]">{student.full_name}</h2>
                      <p className="mt-1 text-xs font-medium text-[#365c60]">{student.email}</p>
                    </article>
                  ))}
                </div>
                {students.length === 0 && <p className="mt-4 text-xs text-[#6d898b]">No enrolled students were found.</p>}
              </section>
            ) : active === "Projects" ? (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <h1 className="text-xl font-bold text-[#003C43]">Projects</h1>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {projects.map((project) => (
                    <article key={project.id} className="theme-surface rounded-xl bg-[#f0f7f6] p-4">
                      <h2 className="font-bold text-[#003C43]">{project.course.name}</h2>
                      <p className="mt-1 text-xs text-[#6d898b]">{project.team_count} teams · {project.min_members_per_team}–{project.max_members_per_team} members</p>
                      <p className="mt-3 line-clamp-3 text-xs text-[#587376]">{project.prd}</p>
                    </article>
                  ))}
                </div>
                {projects.length === 0 && <p className="mt-4 text-xs text-[#6d898b]">No projects are available for your courses.</p>}
              </section>
            ) : active === "Resources" ? (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <h1 className="text-xl font-bold text-[#003C43]">Resources</h1>
                <p className="mt-4 text-xs text-[#6d898b]">{resources.available ? "No course resources have been added." : resources.reason}</p>
              </section>
            ) : (
              <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
                <h1 className="text-xl font-bold text-[#003C43]">Settings</h1>
                <p className="mt-4 text-xs text-[#6d898b]">Instructor settings are not available yet.</p>
                <p className="mt-2 text-xs text-[#6d898b]">Signed in as {instructor.email}</p>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
