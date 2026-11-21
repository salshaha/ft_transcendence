import { useState } from "react";

const STATUS_COLORS = {
  todo: "#77B0AA",
  in_progress: "#E3B341",
  review: "#7C6BD6",
  done: "#135D66",
};

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function emptyStatusCounts() {
  return { todo: 0, in_progress: 0, review: 0, done: 0 };
}

function combineActivity(groups) {
  const first = groups.find((group) => group.length > 0);
  if (!first) return [];
  return first.map((month, index) => ({
    month: month.month,
    label: month.label,
    count: groups.reduce((total, group) => total + (group[index]?.count || 0), 0),
  }));
}

function filterProgress(progress, courseFilter, projectFilter) {
  if (!progress) return progress;
  const courseId = String(courseFilter);
  const projectId = String(projectFilter);
  if (courseId === "all" && projectId === "all") return progress;

  let perProject = progress.per_project || [];
  if (projectId !== "all") {
    perProject = perProject.filter((project) => String(project.id) === projectId);
  }
  if (courseId !== "all") {
    perProject = perProject.filter((project) => String(project.course_id) === courseId);
  }

  const courseIds = new Set(perProject.map((project) => String(project.course_id)));
  if (courseId !== "all") courseIds.add(courseId);
  const perCourse = (progress.per_course || []).filter((course) =>
    courseIds.has(String(course.id)),
  );
  const perTeam = (progress.per_team || []).filter(
    (team) =>
      (projectId === "all" || String(team.project_id) === projectId) &&
      (courseId === "all" || String(team.course_id) === courseId),
  );

  const countSource = perProject.length ? perProject : perCourse;
  const statusCounts = emptyStatusCounts();
  let taskCount = 0;
  let doneTasks = 0;
  let overdueTasks = 0;
  let submissionCount = 0;
  let teamCount = 0;

  for (const source of countSource) {
    const counts = source.status_counts || {};
    for (const status of Object.keys(STATUS_COLORS)) {
      statusCounts[status] += counts[status] || 0;
    }
    taskCount += source.task_count || 0;
    doneTasks += source.done_task_count || counts.done || 0;
    overdueTasks += source.overdue_task_count || 0;
    submissionCount += source.submission_count || 0;
    teamCount += source.team_count || 0;
  }

  const weightedTeamCount = perCourse.reduce(
    (total, course) => total + (course.team_count || 0),
    0,
  );
  const weightedSubmissionRate = perCourse.reduce(
    (total, course) =>
      total + (course.submission_rate_percent || 0) * (course.team_count || 0),
    0,
  );
  const weightedStudentCount = perCourse.reduce(
    (total, course) => total + (course.student_count || 0),
    0,
  );
  const weightedGpa = perCourse.reduce(
    (total, course) =>
      total + (course.average_gpa || 0) * (course.student_count || 0),
    0,
  );

  let submissionActivity = progress.submission_activity || [];
  if (projectId !== "all") {
    submissionActivity = perProject[0]?.submission_activity || [];
  } else if (courseId !== "all") {
    submissionActivity = combineActivity(
      perCourse.map((course) => course.submission_activity || []),
    );
  }

  return {
    ...progress,
    overall: {
      ...progress.overall,
      course_count: perCourse.length,
      project_count: perProject.length,
      student_count: weightedStudentCount,
      team_count: perTeam.length || teamCount,
      task_count: taskCount,
      submission_count: submissionCount,
      status_counts: statusCounts,
      overdue_task_count: overdueTasks,
      completion_percent: pct(doneTasks, taskCount),
      submission_rate_percent: pct(weightedSubmissionRate, weightedTeamCount * 100),
      at_risk_team_count: perTeam.filter(
        (team) => team.overdue_task_count > 0 && !team.has_submission,
      ).length,
      average_gpa: weightedStudentCount
        ? Math.round((weightedGpa / weightedStudentCount) * 100) / 100
        : null,
    },
    per_course: perCourse,
    per_project: perProject,
    per_team: perTeam,
    submission_activity: submissionActivity,
  };
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[#003C43]/8 bg-[#f7fbfa] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77B0AA]">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-[#003C43]">{value ?? 0}</div>
      {hint && <div className="mt-1 text-[10px] text-[#718b8d]">{hint}</div>}
    </div>
  );
}

function Bar({ label, value, suffix = "%", note }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-semibold text-[#003C43]">{label}</span>
        <span className="shrink-0 font-bold text-[#135D66]">{value}{suffix}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#003C43]/8">
        <div className="h-full rounded-full bg-[#135D66] transition-all duration-500" style={{ width: `${width}%` }} />
      </div>
      {note && <div className="mt-1 text-[10px] text-[#718b8d]">{note}</div>}
    </div>
  );
}

export default function ProgressCharts({ progress }) {
  const [courseFilter, setCourseFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const visibleProgress = filterProgress(progress, courseFilter, projectFilter);
  const overall = visibleProgress?.overall || {};
  const statusCounts = overall.status_counts || {};
  const totalTasks = overall.task_count || 0;
  const activity = visibleProgress?.submission_activity || [];
  const maxActivity = Math.max(1, ...activity.map((item) => item.count || 0));
  const visibleProjects = courseFilter === "all"
    ? progress?.per_project || []
    : (progress?.per_project || []).filter((project) => String(project.course_id) === String(courseFilter));
  let accumulated = 0;
  const gradientParts = Object.entries(STATUS_COLORS).map(([status, color]) => {
    const share = totalTasks ? ((statusCounts[status] || 0) / totalTasks) * 100 : 0;
    const start = accumulated;
    accumulated += share;
    return `${color} ${start}% ${accumulated}%`;
  });
  const donutBackground = totalTasks
    ? `conic-gradient(${gradientParts.join(", ")})`
    : "conic-gradient(#e6eeee 0% 100%)";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#003C43]/8 bg-white p-4">
        <label className="text-xs font-semibold text-[#365c60]">Course
          <select
            value={courseFilter}
            onChange={(event) => {
              setCourseFilter(event.target.value);
              setProjectFilter("all");
            }}
            className="ml-2 rounded-lg border border-[#003C43]/15 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All courses</option>
            {(progress?.per_course || []).map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#365c60]">Project
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="ml-2 rounded-lg border border-[#003C43]/15 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All projects</option>
            {visibleProjects.map((project) => (
              <option key={project.id} value={project.id}>{project.title || `Project ${project.id}`}</option>
            ))}
          </select>
        </label>
        {(courseFilter !== "all" || projectFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setCourseFilter("all");
              setProjectFilter("all");
            }}
            className="rounded-lg border border-[#135D66]/20 px-3 py-2 text-xs font-bold text-[#135D66]"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Students" value={overall.student_count} />
        <StatCard label="Teams" value={overall.team_count} hint={`${overall.at_risk_team_count || 0} at risk`} />
        <StatCard label="Tasks" value={overall.task_count} hint={`${overall.completion_percent || 0}% complete`} />
        <StatCard label="Overdue" value={overall.overdue_task_count} hint="unfinished, past due" />
        <StatCard label="Submissions" value={overall.submission_count} hint={`${overall.submission_rate_percent || 0}% of teams`} />
        <StatCard label="Average GPA" value={overall.average_gpa ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-[#003C43]/8 bg-[#f7fbfa] p-5">
          <h3 className="text-sm font-bold text-[#003C43]">Task status distribution</h3>
          <div className="mt-5 flex flex-wrap items-center gap-6">
            <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: donutBackground }}>
              <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
                <div>
                  <div className="text-xl font-extrabold text-[#003C43]">{overall.completion_percent || 0}%</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-[#77B0AA]">complete</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="w-20 font-semibold text-[#365c60]">{status.replaceAll("_", " ")}</span>
                  <span className="font-bold text-[#003C43]">{statusCounts[status] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-5 text-[10px] leading-4 text-[#718b8d]">
            Completion = done tasks / all tasks. Submission rate = teams with at least one submission / all teams.
          </p>
        </section>

        <section className="rounded-2xl border border-[#003C43]/8 bg-[#f7fbfa] p-5">
          <h3 className="text-sm font-bold text-[#003C43]">Completion by project</h3>
          <div className="mt-4 space-y-4">
            {(visibleProgress?.per_project || []).map((project) => (
              <Bar
                key={project.id}
                label={project.title || `Project ${project.id}`}
                value={project.completion_percent}
                note={`${project.done_task_count}/${project.task_count} tasks · ${project.submission_rate_percent}% submitted · ${project.overdue_task_count} overdue`}
              />
            ))}
            {(visibleProgress?.per_project || []).length === 0 && (
              <p className="text-xs text-[#718b8d]">No projects available for this filter.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#003C43]/8 bg-[#f7fbfa] p-5">
          <h3 className="text-sm font-bold text-[#003C43]">Completion by course</h3>
          <div className="mt-4 space-y-4">
            {(visibleProgress?.per_course || []).map((course) => (
              <Bar
                key={course.id}
                label={course.name}
                value={course.completion_percent}
                note={`${course.student_count} students · ${course.team_count} teams · ${course.done_task_count}/${course.task_count} tasks · GPA ${course.average_gpa ?? "—"} · ${course.overdue_task_count} overdue`}
              />
            ))}
            {(visibleProgress?.per_course || []).length === 0 && (
              <p className="text-xs text-[#718b8d]">No course metrics available for this filter.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#003C43]/8 bg-[#f7fbfa] p-5">
          <h3 className="text-sm font-bold text-[#003C43]">Submission activity</h3>
          <p className="mt-1 text-[10px] text-[#718b8d]">Submissions uploaded per month over the last six months.</p>
          <div className="mt-5 flex h-40 items-end gap-3">
            {activity.map((item) => (
              <div key={item.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="w-full max-w-9 rounded-t-lg bg-[#135D66] transition-all duration-500" style={{ height: `${Math.max(3, ((item.count || 0) / maxActivity) * 100)}%` }} title={`${item.label}: ${item.count || 0}`} />
                <span className="text-[9px] text-[#718b8d]">{item.label}</span>
                <span className="text-[10px] font-bold text-[#003C43]">{item.count || 0}</span>
              </div>
            ))}
            {activity.length === 0 && <p className="text-xs text-[#718b8d]">No submission activity available.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#003C43]/8 bg-[#f7fbfa] p-5">
        <h3 className="text-sm font-bold text-[#003C43]">Team progress</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(visibleProgress?.per_team || []).map((team) => (
            <Bar
              key={team.id}
              label={`${team.name} · ${team.course_name || "Course"}`}
              value={team.completion_percent}
              note={`${team.member_count} members · ${team.done_task_count}/${team.task_count} tasks · ${team.overdue_task_count} overdue · ${team.has_submission ? "submitted" : "not submitted"}`}
            />
          ))}
          {(visibleProgress?.per_team || []).length === 0 && (
            <p className="text-xs text-[#718b8d]">No teams available for this filter.</p>
          )}
        </div>
      </section>

      {visibleProgress?.definitions && (
        <p className="text-[10px] leading-4 text-[#718b8d]">
          At risk = {visibleProgress.definitions.at_risk_team_count}. Overdue = {visibleProgress.definitions.overdue_task_count}. Activity = {visibleProgress.definitions.submission_activity}.
        </p>
      )}
    </div>
  );
}
