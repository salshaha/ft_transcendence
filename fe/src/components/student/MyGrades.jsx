import { useEffect, useMemo, useState } from "react";
import { formatDate } from "../instructor/formatters";
import { getStudentGrades } from "../../services/studentService";

export default function MyGrades() {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  useEffect(() => {
    let activeRequest = true;
    setLoading(true);
    setError("");
    getStudentGrades()
      .then((data) => {
        if (activeRequest) setGrades(Array.isArray(data.grades) ? data.grades : []);
      })
      .catch((requestError) => {
        if (activeRequest) setError(requestError.message);
      })
      .finally(() => {
        if (activeRequest) setLoading(false);
      });
    return () => {
      activeRequest = false;
    };
  }, []);

  const courses = useMemo(() => {
    const seen = new Set();
    return grades
      .filter((grade) => {
        if (!grade.course_id || seen.has(grade.course_id)) return false;
        seen.add(grade.course_id);
        return true;
      })
      .map((grade) => ({ id: grade.course_id, name: grade.course_name }));
  }, [grades]);

  const visibleGrades = courseFilter === "all"
    ? grades
    : grades.filter((grade) => String(grade.course_id) === courseFilter);

  return (
    <section className="theme-surface rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.04)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#003C43]">My Grades</h1>
          <p className="mt-1 text-xs text-[#6d898b]">
            Published grades and written feedback from your instructors. Unpublished grades are hidden until released.
          </p>
        </div>
        {courses.length > 0 && (
          <label className="text-xs font-semibold text-[#365c60]">
            Course
            <select
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm sm:w-56"
            >
              <option value="all">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p className="mt-5 rounded-xl bg-[#fff0f0] px-4 py-3 text-xs font-semibold text-[#a94646]" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="mt-5 text-xs text-[#6d898b]" role="status">Loading your grades…</p>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleGrades.map((grade) => {
          const maxGrade = grade.max_grade ?? 100;
          const percentage = grade.grade === null || grade.grade === undefined || !maxGrade
            ? 0
            : Math.max(0, Math.min(100, (grade.grade / maxGrade) * 100));
          return (
            <article
              key={grade.id}
              className="theme-card rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_24px_rgba(0,60,67,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77B0AA]">
                    {grade.course_name || "Course"}
                  </p>
                  <h2 className="mt-1 truncate text-sm font-bold text-[#003C43]">
                    {grade.project_title || "Project"}
                  </h2>
                </div>
                <span className="shrink-0 rounded-full bg-[#dff8f3] px-2.5 py-1 text-[10px] font-bold text-[#135D66]">
                  Published
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#135D66]">
                  {grade.grade === null || grade.grade === undefined ? "—" : grade.grade}
                </span>
                <span className="text-xs font-semibold text-[#718b8d]">/ {maxGrade}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f0f7f6]">
                <div
                  className="h-full rounded-full bg-[#135D66]"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="mt-4 rounded-xl bg-[#f5faf9] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#587376]">
                  Instructor feedback
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#365c60]">
                  {grade.feedback || "No written feedback was provided for this grade."}
                </p>
              </div>

              <p className="mt-3 text-[10px] text-[#718b8d]">
                Published {formatDate(grade.published_at || grade.updated_at)}
              </p>
            </article>
          );
        })}
      </div>

      {!loading && visibleGrades.length === 0 && (
        <p className="mt-5 rounded-2xl border border-[#003C43]/8 bg-white p-6 text-center text-xs text-[#6d898b]">
          No published grades are available yet.
        </p>
      )}
    </section>
  );
}
