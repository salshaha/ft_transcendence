import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadAdminAnalytics,
  downloadAdminAnalyticsPdf,
  downloadAdminData,
  getAdminAnalytics,
  createAdminCourse,
  deleteAdminCourse,
  getAdminCourses,
  getAdminDashboard,
  getAdminUsers,
  createAdminUser,
  deleteAdminUser,
  updateAdminCourse,
  updateAdminUser,
  importAdminData,
  subscribeToAdminAnalytics,
} from "../services/adminService";

const VALID_SEMESTERS = new Set(["fall", "spring", "summer"]);

function validateCourseForm(form, courses, instructors, editingCourseId) {
  const actionVerb = editingCourseId ? "updated" : "created";
  const name = String(form.name || "").trim();
  const academicYear = String(form.academic_year || "").trim();
  const semester = String(form.semester || "").trim().toLowerCase();
  const instructorRaw = String(form.instructor_id ?? "").trim();
  const microsoftClassId = String(form.microsoft_class_id || "").trim();

  const missing = [];
  if (!name) missing.push("Name");
  if (!academicYear) missing.push("Academic year");
  if (!semester) missing.push("Semester");
  if (!instructorRaw) missing.push("Instructor");

  if (missing.length > 0) {
    return {
      error: `Course cannot be ${actionVerb}. Please fill in: ${missing.join(", ")}.`,
    };
  }
  if (academicYear.length > 20) {
    return {
      error: `Course cannot be ${actionVerb}. Academic year must be 20 characters or fewer.`,
    };
  }
  if (!VALID_SEMESTERS.has(semester)) {
    return {
      error: `Course cannot be ${actionVerb}. Please select a valid semester.`,
    };
  }
  const instructorId = Number(instructorRaw);
  if (!Number.isInteger(instructorId) || instructorId <= 0) {
    return {
      error: `Course cannot be ${actionVerb}. Please select a valid instructor.`,
    };
  }
  if (
    instructors.length > 0 &&
    !instructors.some((instructor) => Number(instructor.id) === instructorId)
  ) {
    return {
      error: `Course cannot be ${actionVerb}. Selected instructor was not found.`,
    };
  }
  if (
    microsoftClassId &&
    courses.some(
      (course) =>
        course.id !== editingCourseId &&
        course.microsoft_class_id === microsoftClassId,
    )
  ) {
    return {
      error: `Course cannot be ${actionVerb}. Microsoft Class ID "${microsoftClassId}" is already used by another course.`,
    };
  }

  return {
    payload: {
      name,
      academic_year: academicYear,
      semester,
      instructor_id: instructorId,
      microsoft_class_id: microsoftClassId || null,
    },
  };
}

const SERIES = {
  users: { label: "New accounts", color: "#0f766e" },
  teams: { label: "Teams created", color: "#2563eb" },
  tasks: { label: "Tasks created", color: "#9333ea" },
  submissions: { label: "Submissions", color: "#ea580c" },
  activity_events: { label: "User actions", color: "#0e7490" },
};

function LineChart({ rows, metric }) {
  const width = 760;
  const height = 260;
  const pad = { top: 18, right: 18, bottom: 36, left: 38 };
  const values = rows.map((row) => row[metric]);
  const maxValue = Math.max(1, ...values);
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const points = rows.map((row, index) => ({
    x: pad.left + (rows.length < 2 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth),
    y: pad.top + innerHeight - (row[metric] / maxValue) * innerHeight,
    ...row,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `${points[0].x},${pad.top + innerHeight} ${line} ${points.at(-1).x},${pad.top + innerHeight}`
    : "";
  const labelIndexes = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];

  return (
    <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${SERIES[metric].label} by day`}>
      {[0, 0.5, 1].map((fraction) => {
        const y = pad.top + innerHeight * fraction;
        return <g key={fraction}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5eeeb" /><text x={pad.left - 9} y={y + 4} textAnchor="end" fill="#718b85" fontSize="11">{Math.round(maxValue * (1 - fraction))}</text></g>;
      })}
      {area && <polygon points={area} fill={SERIES[metric].color} opacity=".09" />}
      {points.length > 1 && <polyline points={line} fill="none" stroke={SERIES[metric].color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.5" fill="white" stroke={SERIES[metric].color} strokeWidth="2"><title>{`${point.date}: ${point[metric]}`}</title></circle>)}
      {labelIndexes.map((index) => points[index] && <text key={points[index].date} x={points[index].x} y={height - 8} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"} fill="#718b85" fontSize="11">{points[index].date.slice(5)}</text>)}
    </svg>
  );
}

function BarBreakdown({ items, colors }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <div className="space-y-4">{items.length ? items.map((item, index) => <div key={item.role || item.status}>
    <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="capitalize text-[#3f5c57]">{(item.role || item.status).replaceAll("_", " ")}</span><strong className="text-[#173d38]">{item.count}</strong></div>
    <div className="h-2.5 overflow-hidden rounded-full bg-[#edf3f1]"><div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundColor: colors[index % colors.length] }} /></div>
  </div>) : <p className="text-sm text-[#718b85]">No data for this breakdown yet.</p>}</div>;
}

function MonthlyActivityChart({ data }) {
  if (!data || data.length === 0) return <p className="text-sm text-[#718b85]">No activity recorded in this date range.</p>;
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const chartHeight = 200;
  const barWidth = Math.max(20, Math.floor(600 / data.length) - 8);
  return (
    <div className="mt-2">
      <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${data.length * (barWidth + 8) + 40} ${chartHeight + 40}`} role="img" aria-label="User activity by month">
        {data.map((item, index) => {
          const barHeight = (item.count / maxCount) * chartHeight;
          const x = 20 + index * (barWidth + 8);
          const y = chartHeight - barHeight;
          return (
            <g key={item.month}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill="#0e7490" rx="4" opacity="0.85">
                <title>{`${item.month}: ${item.count} actions`}</title>
              </rect>
              <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" fill="#718b85" fontSize="10">{item.month.slice(5)}</text>
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fill="#173d38" fontSize="10" fontWeight="bold">{item.count}</text>
            </g>
          );
        })}
        {/* Y-axis */}
        <line x1="16" y1="0" x2="16" y2={chartHeight} stroke="#e5eeeb" />
        <text x="12" y="12" textAnchor="end" fill="#718b85" fontSize="10">{maxCount}</text>
        <text x="12" y={chartHeight} textAnchor="end" fill="#718b85" fontSize="10">0</text>
      </svg>
    </div>
  );
}

function shiftDate(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

const NAV_ITEMS = [
  { id: "analytics", label: "Analytics", icon: "chart" },
  { id: "users", label: "Users", icon: "users" },
  { id: "courses", label: "Courses", icon: "book" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const iconPaths = {
  grid: (<><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>),
  users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  book: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>),
  chart: (<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
  chevron: <path d="m9 18 6-6-6-6" />,
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>),
  spark: (<path d="m12 3 1.3 4.2A5 5 0 0 0 16.8 10L21 11.5l-4.2 1.3a5 5 0 0 0-3.5 3.5L12 21l-1.3-4.7a5 5 0 0 0-3.5-3.5L3 11.5 7.2 10a5 5 0 0 0 3.5-2.8Z" />),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>),
  moon: <path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z" />,
};

function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

export default function AdminDashboard({ user, onLogout, onRequestPasswordReset }) {
  const [active, setActive] = useState("analytics");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("team-platform-theme") === "dark");

  // Stats
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [statsLoading, setStatsLoading] = useState(true);

  // Analytics
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(() => shiftDate(new Date(`${today}T00:00:00Z`), -29));
  const [endDate, setEndDate] = useState(today);
  const [metric, setMetric] = useState("users");
  const [monthCount, setMonthCount] = useState(6);

  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - monthCount);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(new Date().toISOString().slice(0, 10));
  }, [monthCount]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dataEntity, setDataEntity] = useState("users");
  const [dataFile, setDataFile] = useState(null);
  const [dataBusy, setDataBusy] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [liveStatus, setLiveStatus] = useState("connecting");
  const refreshRef = useRef(null);

  // Users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", email: "", role: "student", student_id: "" });
  const [savingUser, setSavingUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ first_name: "", last_name: "", email: "", password: "", role: "student", student_id: "" });
  const [savingNewUser, setSavingNewUser] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [deletingUserId, setDeletingUserId] = useState(null);

  // Courses
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ name: "", academic_year: "", semester: "fall", instructor_id: "", microsoft_class_id: "" });
  const [savingCourse, setSavingCourse] = useState(false);
  const [courseMessage, setCourseMessage] = useState("");
  const [courseFormError, setCourseFormError] = useState("");
  const [deletingCourseId, setDeletingCourseId] = useState(null);

  const range = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate]);

  // Load stats
  useEffect(() => {
    let active = true;
    setStatsLoading(true);
    getAdminDashboard()
      .then((data) => { if (active) { setStats(data); setStatsError(""); } })
      .catch((e) => { if (active) setStatsError(e.message); })
      .finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, []);

  // Load users
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userTotal, setUserTotal] = useState(0);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError("");
    getAdminUsers({ search: userSearch, role: userRoleFilter, page: userPage, perPage: 20 })
      .then((data) => {
        setUsers(data.users || []);
        setUserTotal(data.total || 0);
        setUserTotalPages(data.pages || 1);
      })
      .catch((e) => setUsersError(e.message))
      .finally(() => setUsersLoading(false));
  }, [userSearch, userRoleFilter, userPage]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userRoleFilter]);

  useEffect(() => {
    if (active !== "users") return;
    loadUsers();
  }, [active, loadUsers]);

  const loadCourses = useCallback(() => {
    setCoursesLoading(true);
    setCoursesError("");
    getAdminCourses()
      .then((data) => setCourses(data.courses || []))
      .catch((e) => setCoursesError(e.message))
      .finally(() => setCoursesLoading(false));
  }, []);

  // Load courses and instructors
  useEffect(() => {
    if (active !== "courses") return;
    loadCourses();
    getAdminUsers({ role: "instructor", perPage: 100 })
      .then((data) => setInstructors(data.users || []))
      .catch(() => {});
  }, [active, loadCourses]);

  async function handleCreateCourse() {
    const validation = validateCourseForm(courseForm, courses, instructors, null);
    if (validation.error) {
      setCourseFormError(validation.error);
      return;
    }
    setSavingCourse(true);
    setCourseMessage("");
    setCourseFormError("");
    try {
      await createAdminCourse(validation.payload);
      setCreatingCourse(false);
      setCourseForm({ name: "", academic_year: "", semester: "fall", instructor_id: "", microsoft_class_id: "" });
      setCourseMessage("Course created successfully.");
      loadCourses();
      getAdminDashboard().then(setStats).catch(() => {});
    } catch (requestError) {
      setCourseFormError(requestError.message);
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleUpdateCourse() {
    if (!editingCourse) return;
    const validation = validateCourseForm(courseForm, courses, instructors, editingCourse);
    if (validation.error) {
      setCourseFormError(validation.error);
      return;
    }
    setSavingCourse(true);
    setCourseMessage("");
    setCourseFormError("");
    try {
      await updateAdminCourse(editingCourse, validation.payload);
      setEditingCourse(null);
      setCourseForm({ name: "", academic_year: "", semester: "fall", instructor_id: "", microsoft_class_id: "" });
      setCourseMessage("Course updated successfully.");
      loadCourses();
    } catch (requestError) {
      setCourseFormError(requestError.message);
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleDeleteCourse(courseId) {
    if (!window.confirm("Delete this course? This cannot be undone.")) return;
    setDeletingCourseId(courseId);
    setCourseMessage("");
    try {
      await deleteAdminCourse(courseId);
      setCourseMessage("Course deleted.");
      loadCourses();
      getAdminDashboard().then(setStats).catch(() => {});
    } catch (requestError) {
      setCourseMessage(requestError.message);
    } finally {
      setDeletingCourseId(null);
    }
  }

  function startEditCourse(c) {
    setEditingCourse(c.id);
    setCourseForm({
      name: c.name || "",
      academic_year: c.academic_year || "",
      semester: c.semester || "fall",
      instructor_id: c.instructor_id ? String(c.instructor_id) : "",
      microsoft_class_id: c.microsoft_class_id || "",
    });
    setCourseMessage("");
    setCourseFormError("");
  }

  // Analytics
  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setAnalyticsLoading(true);
    try {
      const next = await getAdminAnalytics(range);
      setAnalyticsData(next);
      setAnalyticsError("");
    } catch (requestError) {
      setAnalyticsError(requestError.message);
    } finally {
      if (showLoading) setAnalyticsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (active !== "analytics") return;
    refresh(true);
  }, [active, refresh]);

  useEffect(() => {
    if (active !== "analytics") return;
    const connection = subscribeToAdminAnalytics(
      () => refreshRef.current?.(),
      setLiveStatus,
    );
    const fallbackTimer = window.setInterval(() => {
      if (!connection.isConnected()) refreshRef.current?.();
    }, 30000);
    return () => {
      window.clearInterval(fallbackTimer);
      connection.close();
    };
  }, [active]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("team-platform-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await downloadAdminAnalytics(range);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `platform-analytics-${startDate}-${endDate}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setAnalyticsError(requestError.message);
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const blob = await downloadAdminAnalyticsPdf(range);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `platform-analytics-${startDate}-${endDate}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setAnalyticsError(requestError.message);
    } finally {
      setExporting(false);
    }
  }

  async function exportData(format) {
    setDataBusy(true);
    setDataMessage("");
    try {
      const blob = await downloadAdminData(dataEntity, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${dataEntity}-export.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDataMessage(`${dataEntity} export downloaded.`);
    } catch (requestError) {
      setDataMessage(requestError.message);
    } finally {
      setDataBusy(false);
    }
  }

  async function importData() {
    if (!dataFile) {
      setDataMessage("Choose a CSV or JSON file first.");
      return;
    }
    if (!window.confirm(`Import records from ${dataFile.name}? The batch will be rejected if any row is invalid.`)) return;
    setDataBusy(true);
    setDataMessage("");
    try {
      const result = await importAdminData(dataEntity, dataFile);
      setDataMessage(result.message);
      setDataFile(null);
      const input = document.getElementById("admin-data-import-file");
      if (input) input.value = "";
      refreshRef.current?.();
      loadUsers();
    } catch (requestError) {
      setDataMessage(requestError.message);
    } finally {
      setDataBusy(false);
    }
  }

  function startEditUser(u) {
    setEditingUser(u.id);
    setEditForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email || "",
      role: u.role || "student",
      student_id: u.student_id || "",
    });
    setUserMessage("");
  }

  async function saveEditUser() {
    if (!editingUser) return;
    setSavingUser(true);
    setUserMessage("");
    try {
      await updateAdminUser(editingUser, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        role: editForm.role,
        student_id: editForm.student_id || null,
      });
      setEditingUser(null);
      setUserMessage("User updated successfully.");
      loadUsers();
      // Refresh stats
      getAdminDashboard().then(setStats).catch(() => {});
    } catch (requestError) {
      setUserMessage(requestError.message);
    } finally {
      setSavingUser(false);
    }
  }

  async function handleCreateUser() {
    setSavingNewUser(true);
    setUserMessage("");
    try {
      await createAdminUser({
        first_name: newUserForm.first_name,
        last_name: newUserForm.last_name,
        email: newUserForm.email,
        password: newUserForm.password,
        role: newUserForm.role,
        student_id: newUserForm.student_id || null,
      });
      setCreatingUser(false);
      setNewUserForm({ first_name: "", last_name: "", email: "", password: "", role: "student", student_id: "" });
      setUserMessage("User created successfully.");
      loadUsers();
      getAdminDashboard().then(setStats).catch(() => {});
    } catch (requestError) {
      setUserMessage(requestError.message);
    } finally {
      setSavingNewUser(false);
    }
  }

  async function handleDeleteUser(userId) {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    setDeletingUserId(userId);
    setUserMessage("");
    try {
      await deleteAdminUser(userId);
      setUserMessage("User deleted.");
      loadUsers();
      getAdminDashboard().then(setStats).catch(() => {});
    } catch (requestError) {
      setUserMessage(requestError.message);
    } finally {
      setDeletingUserId(null);
    }
  }

  const cards = stats ? [
    ["Total users", stats.users, `${stats.students} students`],
    ["Students", stats.students, `${stats.instructors} instructors`],
    ["Instructors", stats.instructors, `${stats.admins} admins`],
    ["Administrators", stats.admins, "Platform admins"],
    ["Courses", stats.courses, `${stats.projects} projects`],
    ["Projects", stats.projects, `${stats.teams} teams`],
    ["Teams", stats.teams, `${stats.submissions} submissions`],
    ["Submissions", stats.submissions, "Total submitted"],
  ] : [];

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="theme-page min-h-screen bg-[#f5faf9] text-[#183f43] transition-colors duration-300">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#003C43] py-6 text-white transition-all duration-300 lg:translate-x-0 ${sidebarCollapsed ? "lg:w-[88px] lg:px-4" : "lg:w-[272px] lg:px-5"} px-5 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {mobileOpen && <div className="fixed inset-0 z-40 bg-[#003C43]/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
          <div className="flex items-center gap-3 px-2">
            <div className="theme-invert grid h-10 w-10 place-items-center rounded-xl bg-[#E3FEF7] text-[#003C43]">
              <Icon name="spark" />
            </div>
            <div className={sidebarCollapsed ? "lg:hidden" : ""}>
              <div className="text-[17px] font-bold tracking-tight">Team-Platform</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#77B0AA]">Admin portal</div>
            </div>
          </div>
          <nav className="mt-10 flex-1 space-y-1.5">
            <div className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#77B0AA] ${sidebarCollapsed ? "lg:text-center lg:text-[0px]" : ""}`}>Workspace</div>
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => { setActive(item.id); setMobileOpen(false); }} title={sidebarCollapsed ? item.label : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${sidebarCollapsed ? "lg:justify-center" : ""} ${active === item.id ? "bg-[#E3FEF7] text-[#003C43] shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/8 hover:text-white"}`}>
                <Icon name={item.icon} className="h-[19px] w-[19px]" />
                <span className={sidebarCollapsed ? "lg:hidden" : ""}>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <div className={`flex items-center gap-3 ${sidebarCollapsed ? "lg:justify-center" : ""}`}>
              <div className="theme-invert grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#77B0AA] text-xs font-bold text-[#003C43]">
                {`${(user?.first_name || "A")[0]}${(user?.last_name || "D")[0]}`}
              </div>
              <div className={`min-w-0 flex-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                <div className="truncate text-sm font-semibold">{user?.full_name || `${user?.first_name} ${user?.last_name}`}</div>
                <div className="truncate text-[11px] text-white/50">{user?.email}</div>
              </div>
              <button className={`rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white ${sidebarCollapsed ? "lg:hidden" : ""}`} aria-label="Sign out" onClick={onLogout}>
                <Icon name="logout" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <main className={`min-h-screen transition-[margin] duration-300 ${sidebarCollapsed ? "lg:ml-[88px]" : "lg:ml-[272px]"}`}>
          <header className="theme-header sticky top-0 z-30 flex h-[76px] items-center border-b border-[#003C43]/8 bg-[#f5faf9]/90 px-4 backdrop-blur-xl transition-colors sm:px-8 lg:px-10">
            <button className="theme-control mr-3 rounded-xl border border-[#003C43]/10 bg-white p-2.5 text-[#003C43] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Icon name="menu" />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#77B0AA]">Admin portal</div>
              <div className="truncate text-lg font-bold text-[#003C43]">{active.charAt(0).toUpperCase() + active.slice(1)}</div>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button className="theme-control grid h-10 w-10 place-items-center rounded-xl border border-[#003C43]/10 bg-white text-[#135D66] transition hover:border-[#77B0AA] hover:bg-[#E3FEF7]" onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={darkMode}>
                <Icon name={darkMode ? "sun" : "moon"} className="h-[18px] w-[18px]" />
              </button>
              <button className="theme-control grid h-10 w-10 place-items-center rounded-xl border border-[#003C43]/10 bg-white text-[#135D66] transition hover:border-[#77B0AA] hover:bg-[#E3FEF7]" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                <Icon name="chevron" className={`h-[18px] w-[18px] transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`} />
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-4 sm:p-8 lg:p-10">
            {/* Users */}
            {active === "users" && (
              <>
                <div className="mb-7">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#135D66]">User management</div>
                  <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#003C43] sm:text-[30px]">Users</h1>
                  <p className="mt-2 text-sm leading-6 text-[#6d898b]">View, search, filter, and manage all registered users.</p>
                </div>
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-[#dfeae6] bg-white p-4 shadow-sm">
                  <label className="grid gap-1 text-xs font-semibold text-[#56736d]">
                    Search
                    <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Name, email, or student ID" className="rounded-lg border border-[#dce7e3] px-3 py-2 text-sm text-[#173d38]" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-[#56736d]">
                    Role
                    <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} className="rounded-lg border border-[#dce7e3] px-3 py-2 text-sm text-[#173d38]">
                      <option value="">All roles</option>
                      <option value="student">Student</option>
                      <option value="instructor">Instructor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <button onClick={loadUsers} className="rounded-lg bg-[#075e54] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#064e46]">Search</button>
                  <button onClick={() => setCreatingUser(true)} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2.5 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa]">+ Add user</button>
                </div>
                {userMessage && <p className="mb-4 rounded-xl border border-[#135D66]/15 bg-[#E3FEF7] px-4 py-3 text-sm font-semibold text-[#135D66]" role="status">{userMessage}</p>}
                {usersError && <p className="mb-4 rounded-xl border border-[#f0d2d2] bg-white p-4 text-sm text-[#a94646]" role="alert">{usersError}</p>}
                {usersLoading ? <p className="py-10 text-center text-sm text-[#718b85]" role="status">Loading users…</p> : (
                  <>
                    <div className="overflow-x-auto rounded-2xl border border-[#dfeae6] bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-[#f3f8f6] text-xs font-semibold text-[#56736d]">
                          <tr>
                            <th className="px-4 py-3 text-left">Name</th>
                            <th className="px-4 py-3 text-left">Email</th>
                            <th className="px-4 py-3 text-left">Role</th>
                            <th className="px-4 py-3 text-left">Student ID</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf3f1]">
                          {users.map((u) => (
                            <tr key={u.id} className="hover:bg-[#f8fbfa]">
                              <td className="px-4 py-3 font-medium text-[#173d38]">{u.first_name} {u.last_name}</td>
                              <td className="px-4 py-3 text-[#41615b]">{u.email}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.role === "admin" ? "bg-purple-100 text-purple-700" : u.role === "instructor" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{u.role}</span>
                              </td>
                              <td className="px-4 py-3 text-[#41615b]">{u.student_id || "—"}</td>
                              <td className="px-4 py-3 text-right">
                                <button onClick={() => startEditUser(u)} className="mr-2 rounded-lg border border-[#cdded9] bg-white px-3 py-1.5 text-xs font-semibold text-[#28675d] hover:bg-[#f8fbfa]">Edit</button>
                                <button onClick={() => handleDeleteUser(u.id)} disabled={deletingUserId === u.id} className="rounded-lg border border-[#f0d2d2] bg-white px-3 py-1.5 text-xs font-semibold text-[#a94646] hover:bg-[#fff0f0] disabled:opacity-50">
                                  {deletingUserId === u.id ? "…" : "Delete"}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#718b85]">No users found.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {userTotalPages > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-3">
                        <button type="button" disabled={userPage <= 1} onClick={() => setUserPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-xs font-bold text-[#003C43] disabled:opacity-40">Previous</button>
                        <span className="text-xs font-bold text-[#718b8d]">Page {userPage} of {userTotalPages} · {userTotal} users</span>
                        <button type="button" disabled={userPage >= userTotalPages} onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))} className="rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-xs font-bold text-[#003C43] disabled:opacity-40">Next</button>
                      </div>
                    )}
                  </>)}

                {/* Create user modal */}
                {creatingUser && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreatingUser(false)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                      <h2 className="mb-4 text-lg font-bold text-[#003C43]">Create user</h2>
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-[#56736d]">First name<input value={newUserForm.first_name} onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                        <label className="block text-xs font-semibold text-[#56736d]">Last name<input value={newUserForm.last_name} onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                        <label className="block text-xs font-semibold text-[#56736d]">Email<input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                        <label className="block text-xs font-semibold text-[#56736d]">Password<input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                        <label className="block text-xs font-semibold text-[#56736d]">
                          Role
                          <select value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm">
                            <option value="student">Student</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </label>
                        {newUserForm.role === "student" && (
                          <label className="block text-xs font-semibold text-[#56736d]">Student ID<input value={newUserForm.student_id} onChange={(e) => setNewUserForm({ ...newUserForm, student_id: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                        )}
                      </div>
                      <div className="mt-5 flex justify-end gap-2">
                        <button onClick={() => setCreatingUser(false)} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa]">Cancel</button>
                        <button onClick={handleCreateUser} disabled={savingNewUser} className="rounded-lg bg-[#075e54] px-4 py-2 text-sm font-semibold text-white hover:bg-[#064e46] disabled:opacity-50">
                          {savingNewUser ? "Creating…" : "Create"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit user modal */}
                {editingUser && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingUser(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                      <h2 className="mb-4 text-lg font-bold text-[#003C43]">Edit user</h2>
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-[#56736d]">First name<input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                        <label className="block text-xs font-semibold text-[#56736d]">Last name<input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                        <label className="block text-xs font-semibold text-[#56736d]">Email<input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                        <label className="block text-xs font-semibold text-[#56736d]">
                          Role
                          <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm">
                            <option value="student">Student</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-[#56736d]">Student ID<input value={editForm.student_id} onChange={(e) => setEditForm({ ...editForm, student_id: e.target.value })} className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm" /></label>
                      </div>
                      <div className="mt-5 flex justify-end gap-2">
                        <button onClick={() => setEditingUser(null)} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa]">Cancel</button>
                        <button onClick={saveEditUser} disabled={savingUser} className="rounded-lg bg-[#075e54] px-4 py-2 text-sm font-semibold text-white hover:bg-[#064e46] disabled:opacity-50">
                          {savingUser ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Courses */}
            {active === "courses" && (
              <>
                <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#135D66]">Course oversight</div>
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#003C43] sm:text-[30px]">Courses</h1>
                    <p className="mt-2 text-sm leading-6 text-[#6d898b]">View all courses, instructors, and enrollment counts.</p>
                  </div>
                  <button onClick={() => { setCreatingCourse(true); setCourseForm({ name: "", academic_year: "", semester: "fall", instructor_id: "", microsoft_class_id: "" }); setCourseMessage(""); setCourseFormError(""); }} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2.5 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa]">+ Add course</button>
                </div>
                {courseMessage && <p className="mb-4 rounded-xl border border-[#135D66]/15 bg-[#E3FEF7] px-4 py-3 text-sm font-semibold text-[#135D66]" role="status">{courseMessage}</p>}
                {coursesError && <p className="mb-4 rounded-xl border border-[#f0d2d2] bg-white p-4 text-sm text-[#a94646]" role="alert">{coursesError}</p>}
                {coursesLoading ? <p className="py-10 text-center text-sm text-[#718b85]" role="status">Loading courses…</p> : (
                  <div className="overflow-x-auto rounded-2xl border border-[#dfeae6] bg-white shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-[#f3f8f6] text-xs font-semibold text-[#56736d]">
                        <tr>
                          <th className="px-4 py-3 text-left">Course</th>
                          <th className="px-4 py-3 text-left">Academic Year</th>
                          <th className="px-4 py-3 text-left">Semester</th>
                          <th className="px-4 py-3 text-left">Instructor ID</th>
                          <th className="px-4 py-3 text-left">Students</th>
                          <th className="px-4 py-3 text-left">Projects</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf3f1]">
                        {courses.map((c) => (
                          <tr key={c.id} className="hover:bg-[#f8fbfa]">
                            <td className="px-4 py-3 font-medium text-[#173d38]">{c.name}</td>
                            <td className="px-4 py-3 text-[#41615b]">{c.academic_year}</td>
                            <td className="px-4 py-3 text-[#41615b]">{c.semester}</td>
                            <td className="px-4 py-3 text-[#41615b]">{c.instructor_id || "—"}</td>
                            <td className="px-4 py-3 text-[#41615b]">{c.student_count}</td>
                            <td className="px-4 py-3 text-[#41615b]">{(c.projects || []).map((p) => p.title).join(", ") || "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => startEditCourse(c)} className="mr-2 rounded-lg border border-[#cdded9] bg-white px-3 py-1.5 text-xs font-semibold text-[#28675d] hover:bg-[#f8fbfa]">Edit</button>
                              <button onClick={() => handleDeleteCourse(c.id)} disabled={deletingCourseId === c.id} className="rounded-lg border border-[#f0d2d2] bg-white px-3 py-1.5 text-xs font-semibold text-[#a94646] hover:bg-[#fff0f0] disabled:opacity-50">
                                {deletingCourseId === c.id ? "…" : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {courses.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#718b85]">No courses found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Create/Edit course modal */}
                {(creatingCourse || editingCourse) && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setCreatingCourse(false); setEditingCourse(null); setCourseFormError(""); }}>
                    <form
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editingCourse) handleUpdateCourse();
                        else handleCreateCourse();
                      }}
                      className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h2 className="mb-4 text-lg font-bold text-[#003C43]">{editingCourse ? "Edit course" : "Create course"}</h2>
                      {courseFormError && (
                        <p className="mb-4 rounded-xl border border-[#f0d2d2] bg-[#fff5f5] px-3 py-2.5 text-xs font-semibold text-[#a94646]" role="alert">
                          {courseFormError}
                        </p>
                      )}
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-[#56736d]">
                          Name *
                          <input
                            value={courseForm.name}
                            onChange={(e) => {
                              setCourseForm({ ...courseForm, name: e.target.value });
                              setCourseFormError("");
                            }}
                            placeholder="e.g. Software Engineering"
                            className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-[#56736d]">
                          Academic year *
                          <input
                            value={courseForm.academic_year}
                            onChange={(e) => {
                              setCourseForm({ ...courseForm, academic_year: e.target.value });
                              setCourseFormError("");
                            }}
                            placeholder="2025/2026"
                            className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-[#56736d]">
                          Semester *
                          <select
                            value={courseForm.semester}
                            onChange={(e) => {
                              setCourseForm({ ...courseForm, semester: e.target.value });
                              setCourseFormError("");
                            }}
                            className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm"
                          >
                            <option value="fall">Fall</option>
                            <option value="spring">Spring</option>
                            <option value="summer">Summer</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-[#56736d]">
                          Instructor *
                          {instructors.length > 0 ? (
                            <select
                              value={courseForm.instructor_id}
                              onChange={(e) => {
                                setCourseForm({ ...courseForm, instructor_id: e.target.value });
                                setCourseFormError("");
                              }}
                              className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm"
                            >
                              <option value="">Select an instructor…</option>
                              {instructors.map((instructor) => (
                                <option key={instructor.id} value={String(instructor.id)}>
                                  {instructor.full_name || `${instructor.first_name || ""} ${instructor.last_name || ""}`.trim() || instructor.email} (ID: {instructor.id})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              min="1"
                              value={courseForm.instructor_id}
                              onChange={(e) => {
                                setCourseForm({ ...courseForm, instructor_id: e.target.value });
                                setCourseFormError("");
                              }}
                              placeholder="Instructor user ID"
                              className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm"
                            />
                          )}
                        </label>
                        <label className="block text-xs font-semibold text-[#56736d]">
                          Microsoft Class ID (optional)
                          <input
                            value={courseForm.microsoft_class_id}
                            onChange={(e) => {
                              setCourseForm({ ...courseForm, microsoft_class_id: e.target.value });
                              setCourseFormError("");
                            }}
                            className="mt-1 w-full rounded-lg border border-[#dce7e3] px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                      <div className="mt-5 flex justify-end gap-2">
                        <button type="button" onClick={() => { setCreatingCourse(false); setEditingCourse(null); setCourseFormError(""); }} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa]">Cancel</button>
                        <button type="submit" disabled={savingCourse} className="rounded-lg bg-[#075e54] px-4 py-2 text-sm font-semibold text-white hover:bg-[#064e46] disabled:opacity-50">
                          {savingCourse ? "Saving…" : (editingCourse ? "Update" : "Create")}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {/* Analytics */}
            {active === "analytics" && (
              <>
                <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
                  <div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#4f8980]">Platform overview</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Analytics dashboard</h1><p className="mt-2 text-sm text-[#718b85]">Platform activity, engagement, and key metrics at a glance.</p></div>
                  <button onClick={onLogout} className="rounded-xl border border-[#d8e5e1] bg-white px-4 py-2.5 text-sm font-semibold text-[#41615b] hover:bg-[#f8fbfa]">Sign out</button>
                </header>
                {statsError && <p className="mb-5 rounded-xl border border-[#f0d2d2] bg-white p-4 text-sm text-[#a94646]" role="alert">{statsError}</p>}
                {statsLoading ? <p className="py-10 text-center text-sm text-[#718b85]" role="status">Loading stats…</p> : (
                  <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform totals">
                    {cards.map(([label, value, note]) => (
                      <article key={label} className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-[#718b85]">{label}</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight">{Number(value).toLocaleString()}</p>
                        <p className="mt-2 text-xs text-[#4f8980]">{note}</p>
                      </article>
                    ))}
                  </section>
                )}
                <section className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[#dfeae6] bg-white p-4 shadow-sm" aria-label="Analytics filters">
                  <label className="grid gap-1 text-xs font-semibold text-[#56736d]">From<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-[#dce7e3] px-3 py-2 text-sm text-[#173d38]" /></label>
                  <label className="grid gap-1 text-xs font-semibold text-[#56736d]">To<input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-[#dce7e3] px-3 py-2 text-sm text-[#173d38]" /></label>
                  <div className="flex flex-wrap gap-2">
                    {[7, 30, 90].map((days) => <button key={days} onClick={() => { setStartDate(shiftDate(new Date(`${today}T00:00:00Z`), -(days - 1))); setEndDate(today); }} className="rounded-lg bg-[#edf6f3] px-3 py-2 text-xs font-semibold text-[#28675d] hover:bg-[#dff0ea]">{days} days</button>)}
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <button onClick={exportCsv} disabled={!analyticsData || exporting} className="rounded-lg bg-[#075e54] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#064e46] disabled:opacity-50">{exporting ? "Preparing…" : "Export CSV"}</button>
                    <button onClick={exportPdf} disabled={!analyticsData || exporting} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2.5 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa] disabled:opacity-50">Export PDF</button>
                  </div>
                </section>
                {analyticsError && <p className="mb-5 rounded-xl border border-[#f0d2d2] bg-white p-4 text-sm text-[#a94646]" role="alert">{analyticsError}</p>}
                {analyticsLoading && !analyticsData ? <p className="py-20 text-center text-sm text-[#718b85]" role="status">Loading platform analytics…</p> : analyticsData && <>
                  <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,1fr)]">
                    <article className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Activity over time</h2><p className="mt-1 text-xs text-[#718b85]">Daily records created during the selected period</p></div><select aria-label="Activity type" value={metric} onChange={(event) => setMetric(event.target.value)} className="rounded-lg border border-[#dce7e3] bg-white px-3 py-2 text-sm">{Object.entries(SERIES).map(([key, series]) => <option key={key} value={key}>{series.label}</option>)}</select></div>
                      <LineChart rows={analyticsData.timeline} metric={metric} />
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#718b85]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[metric].color }} />{SERIES[metric].label}<span className="ml-auto flex items-center gap-2" aria-live="polite"><span className={`h-2 w-2 rounded-full ${liveStatus === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />{liveStatus === "connected" ? "Live updates connected" : "Reconnecting · refresh fallback every 30 seconds"}</span></div>
                    </article>
                    <article className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-bold">User activity</h2><p className="mb-5 mt-1 text-xs text-[#718b85]">New records and tracked account actions in this period</p><div className="grid grid-cols-2 gap-3">{[["New users", analyticsData.period.users], ["New teams", analyticsData.period.teams], ["New tasks", analyticsData.period.tasks], ["Submissions", analyticsData.period.submissions], ["Actions logged", analyticsData.activity_count]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f3f8f6] p-4"><div className="text-2xl font-bold">{value.toLocaleString()}</div><div className="mt-1 text-xs text-[#718b85]">{label}</div></div>)}</div></article>
                  </section>
                  <section className="grid gap-5 md:grid-cols-2">
                    <article className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-1 font-bold">Users by role</h2><p className="mb-5 text-xs text-[#718b85]">Current account mix</p><BarBreakdown items={analyticsData.user_roles} colors={["#0f766e", "#2563eb", "#9333ea"]} /></article>
                    <article className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-1 font-bold">Tasks by status</h2><p className="mb-5 text-xs text-[#718b85]">Current work distribution</p><BarBreakdown items={analyticsData.task_statuses} colors={["#94a3b8", "#2563eb", "#0f766e", "#f59e0b"]} /></article>
                  </section>
                  <section className="mt-5 rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6" aria-label="Monthly user activity">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold">User activity by month</h2>
                        <p className="mt-1 text-xs text-[#718b85]">Number of user actions (sign-ins, changes) recorded per month. Select how many months to display.</p>
                      </div>
                      <label className="grid gap-1 text-xs font-semibold text-[#56736d]">
                        Months to show
                        <select value={monthCount} onChange={(e) => setMonthCount(Number(e.target.value))} className="rounded-lg border border-[#dce7e3] bg-white px-3 py-2 text-sm text-[#173d38]">
                          <option value={3}>3 months</option>
                          <option value={6}>6 months</option>
                          <option value={9}>9 months</option>
                          <option value={12}>12 months</option>
                        </select>
                      </label>
                    </div>
                    {analyticsData.monthly_activity && analyticsData.monthly_activity.length > 0 ? (
                      <MonthlyActivityChart data={analyticsData.monthly_activity.slice(-monthCount)} />
                    ) : (
                      <p className="text-sm text-[#718b85]">No activity recorded in this date range.</p>
                    )}
                  </section>
                  <section className="mt-5 rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6" aria-label="Platform data import and export">
                    <div className="mb-4"><h2 className="font-bold">Platform data</h2><p className="mt-1 text-xs text-[#718b85]">Export or import up to 500 user or course records. Passwords are never included in exports; user imports require a password for every account.</p></div>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="grid gap-1 text-xs font-semibold text-[#56736d]">Data type<select value={dataEntity} onChange={(event) => { setDataEntity(event.target.value); setDataMessage(""); }} className="rounded-lg border border-[#dce7e3] bg-white px-3 py-2 text-sm text-[#173d38]"><option value="users">Users</option><option value="courses">Courses</option></select></label>
                      <button onClick={() => exportData("csv")} disabled={dataBusy} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2.5 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa] disabled:opacity-50">Export CSV</button>
                      <button onClick={() => exportData("json")} disabled={dataBusy} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2.5 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa] disabled:opacity-50">Export JSON</button>
                      <label className="grid gap-1 text-xs font-semibold text-[#56736d]">Import CSV or JSON<input id="admin-data-import-file" type="file" accept=".csv,.json,application/json,text/csv" onChange={(event) => { setDataFile(event.target.files?.[0] || null); setDataMessage(""); }} className="max-w-xs rounded-lg border border-[#dce7e3] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#edf6f3] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#28675d]" /></label>
                      <button onClick={importData} disabled={dataBusy || !dataFile} className="rounded-lg bg-[#075e54] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#064e46] disabled:opacity-50">{dataBusy ? "Working…" : "Import batch"}</button>
                    </div>
                    {dataMessage && <p className="mt-3 text-sm text-[#41615b]" role="status">{dataMessage}</p>}
                  </section>
                  <section className="mt-5 rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6" aria-label="Recent user activity">
                    <div className="mb-4"><h2 className="font-bold">Recent activity</h2><p className="mt-1 text-xs text-[#718b85]">Successful sign-ins and key changes by users and administrators in the selected date range.</p></div>
                    {analyticsData.recent_activity.length ? <ul className="divide-y divide-[#edf3f1]">{analyticsData.recent_activity.map((event) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><p className="text-sm text-[#3f5c57]"><strong className="font-semibold text-[#173d38]">{event.actor_name}</strong>{" "}{event.action.replaceAll("_", " ")}{event.entity_type !== "session" && <span className="text-[#718b85]"> · {event.entity_type.replaceAll("_", " ")}{event.entity_id ? ` #${event.entity_id}` : ""}</span>}</p><time dateTime={event.occurred_at} className="text-xs text-[#718b85]">{new Date(event.occurred_at).toLocaleString()}</time></li>)}</ul> : <p className="text-sm text-[#718b85]">No recorded activity in this date range yet.</p>}
                  </section>
                  <p className="mt-5 text-right text-xs text-[#8aa09b]">Range: {analyticsData.start_date} to {analyticsData.end_date}</p>
                </>}
              </>
            )}

            {/* Settings */}
            {active === "settings" && (
              <div>
                <div className="mb-7">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6D5BD0]">Account preferences</div>
                  <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#003C43] sm:text-[30px]">Settings</h1>
                  <p className="mt-2 text-sm leading-6 text-[#6d898b]">Review your account and keep it secure.</p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-7">
                    <h2 className="text-lg font-extrabold text-[#003C43]">Account</h2>
                    <p className="mt-3 break-all text-xs font-semibold text-[#365c60]">{user?.first_name} {user?.last_name}</p>
                    <p className="mt-2 break-all text-xs text-[#6d898b]">{user?.email}</p>
                    <button type="button" onClick={onLogout} className="mt-6 rounded-xl border border-[#003C43]/15 px-4 py-3 text-xs font-bold text-[#135D66] transition hover:bg-[#E3FEF7]">Sign out</button>
                  </section>
                  <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-7">
                    <h2 className="text-lg font-extrabold text-[#003C43]">Password &amp; security</h2>
                    <p className="mt-2 text-xs leading-5 text-[#6d898b]">Request a one-time token to choose a new password for your account. Tokens expire after one hour and can be used once.</p>
                    <button type="button" onClick={() => onRequestPasswordReset(user?.email)} className="mt-6 w-full rounded-xl border border-[#6D5BD0]/25 px-4 py-3 text-xs font-bold text-[#6D5BD0] transition hover:bg-[#f5f3ff] active:scale-[0.98]">Reset password</button>
                  </section>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}