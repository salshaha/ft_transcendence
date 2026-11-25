import { useState } from "react";

const STATUS_KEYS = ["todo", "in_progress", "review", "done"];
const TASK_PROGRESS_COLOR = "#135D66";

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function emptyStatusCounts() {
  return { todo: 0, in_progress: 0, review: 0, done: 0 };
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
  let teamCount = 0;

  for (const source of countSource) {
    const counts = source.status_counts || {};
    for (const status of STATUS_KEYS) {
      statusCounts[status] += counts[status] || 0;
    }
    taskCount += source.task_count || 0;
    doneTasks += source.done_task_count || counts.done || 0;
    teamCount += source.team_count || 0;
  }

  return {
    ...progress,
    overall: {
      ...progress.overall,
      course_count: perCourse.length,
      project_count: perProject.length,
      team_count: perTeam.length || teamCount,
      task_count: taskCount,
      done_task_count: doneTasks,
      status_counts: statusCounts,
      completion_percent: pct(doneTasks, taskCount),
    },
    per_course: perCourse,
    per_project: perProject,
    per_team: perTeam,
  };
}

function Bar({ label, value, note }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-semibold text-[#003C43]">{label}</span>
        <span className="shrink-0 font-bold text-[#135D66]">{value}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#003C43]/8">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: TASK_PROGRESS_COLOR }}
        />
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
  const doneTasks = overall.done_task_count || 0;
  const totalTasks = overall.task_count || 0;
  const completionPercent = pct(doneTasks, totalTasks);
  const visibleProjects = courseFilter === "all"
    ? progress?.per_project || []
    : (progress?.per_project || []).filter((project) => String(project.course_id) === String(courseFilter));

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

      <section className="rounded-2xl border border-[#003C43]/8 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#003C43]">Task progress</h3>
            <p className="mt-1 text-xs text-[#718b8d]">
              {doneTasks} of {totalTasks} tasks completed
            </p>
          </div>
          <span className="text-2xl font-extrabold text-[#135D66]">{completionPercent}%</span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#003C43]/8">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${completionPercent}%`,
              backgroundColor: TASK_PROGRESS_COLOR,
            }}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#003C43]/8 bg-white p-5">
          <h3 className="text-sm font-bold text-[#003C43]">Completion by project</h3>
          <div className="mt-4 space-y-4">
            {(visibleProgress?.per_project || []).map((project) => (
              <Bar
                key={project.id}
                label={project.title || `Project ${project.id}`}
                value={project.completion_percent}
                note={`${project.done_task_count}/${project.task_count} tasks`}
              />
            ))}
            {(visibleProgress?.per_project || []).length === 0 && (
              <p className="text-xs text-[#718b8d]">No projects available for this filter.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#003C43]/8 bg-white p-5">
          <h3 className="text-sm font-bold text-[#003C43]">Completion by course</h3>
          <div className="mt-4 space-y-4">
            {(visibleProgress?.per_course || []).map((course) => (
              <Bar
                key={course.id}
                label={course.name}
                value={course.completion_percent}
                note={`${course.student_count} students · ${course.team_count} teams · ${course.done_task_count}/${course.task_count} tasks`}
              />
            ))}
            {(visibleProgress?.per_course || []).length === 0 && (
              <p className="text-xs text-[#718b8d]">No course metrics available for this filter.</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#003C43]/8 bg-white p-5">
        <h3 className="text-sm font-bold text-[#003C43]">Team progress</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(visibleProgress?.per_team || []).map((team) => (
            <Bar
              key={team.id}
              label={`${team.name} · ${team.course_name || "Course"}`}
              value={team.completion_percent}
              note={`${team.member_count} members · ${team.done_task_count}/${team.task_count} tasks · ${team.overdue_task_count} overdue`}
            />
          ))}
          {(visibleProgress?.per_team || []).length === 0 && (
            <p className="text-xs text-[#718b8d]">No teams available for this filter.</p>
          )}
        </div>
      </section>
    </div>
  );
}
