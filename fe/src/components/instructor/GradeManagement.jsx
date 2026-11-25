import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { formatDate } from "./formatters";
import {
  getInstructorCourseStudents,
  getInstructorGradeAudit,
  getInstructorGrades,
  publishAllInstructorGrades,
  saveInstructorGrade,
  setInstructorGradePublished,
} from "../../services/instructorService";

export default function GradeManagement({ courses = [], projects = [] }) {
  const [courseId, setCourseId] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [grades, setGrades] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [publishingAll, setPublishingAll] = useState(false);

  const courseOptions = useMemo(() => courses, [courses]);
  const projectOptions = useMemo(() => {
    const course = courseOptions.find((item) => String(item.id) === String(courseId));
    return course?.projects || [];
  }, [courseOptions, courseId]);

  useEffect(() => {
    if (courseOptions.length === 0) {
      setCourseId("");
      return;
    }
    if (!courseOptions.some((course) => String(course.id) === String(courseId))) {
      setCourseId(String(courseOptions[0].id));
    }
  }, [courseOptions, courseId]);

  async function loadStudents(selectedCourseId) {
    if (!selectedCourseId) {
      setStudents([]);
      return;
    }
    try {
      const data = await getInstructorCourseStudents(selectedCourseId);
      setStudents(Array.isArray(data.students) ? data.students : []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function loadGrades() {
    if (!courseId) {
      setGrades([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getInstructorGrades({
        courseId: Number(courseId),
        projectId: projectId === "all" ? null : Number(projectId),
        studentId: studentId === "all" ? null : Number(studentId),
      });
      setGrades(Array.isArray(data.grades) ? data.grades : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setProjectId("all");
    setStudentId("all");
    loadStudents(courseId);
  }, [courseId]);

  useEffect(() => {
    loadGrades();
  }, [courseId, projectId, studentId]);

  function maxGradeFor(projectIdValue) {
    const project = projects.find((item) => String(item.id) === String(projectIdValue));
    return project?.max_grade ?? 100;
  }

  function openCreate() {
    if (!courseId) {
      setNotice("Select a course first.");
      return;
    }
    if (students.length === 0 || projectOptions.length === 0) {
      setNotice("Enroll students and create a project before recording grades.");
      return;
    }
    setNotice("");
    setError("");
    setEditor({
      gradeId: null,
      studentId: String(students[0].id),
      projectId: String(projectOptions[0].id),
      grade: "",
      feedback: "",
      published: false,
    });
  }

  function openEdit(grade) {
    setNotice("");
    setError("");
    setEditor({
      gradeId: grade.id,
      studentId: String(grade.student_id),
      projectId: String(grade.project_id),
      grade: grade.grade === null || grade.grade === undefined ? "" : String(grade.grade),
      feedback: grade.feedback || "",
      published: false,
    });
  }

  async function saveGrade(event) {
    event.preventDefault();
    if (!editor) return;

    const numericGrade = Number(editor.grade);
    const maxGrade = maxGradeFor(editor.projectId);
    if (editor.grade === "" || !Number.isFinite(numericGrade)) {
      setError("Enter a numeric grade.");
      return;
    }
    if (numericGrade < 0 || numericGrade > maxGrade) {
      setError(`Grade must be between 0 and ${maxGrade}.`);
      return;
    }
    if (
      editor.published &&
      !window.confirm(
        `Publish this grade for ${students.find((item) => String(item.id) === String(editor.studentId))?.full_name || "this student"}? Published grades are visible to the student.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await saveInstructorGrade(
        {
          student_id: Number(editor.studentId),
          project_id: Number(editor.projectId),
          grade: numericGrade,
          feedback: editor.feedback.trim() || null,
          published: editor.published,
        },
        editor.gradeId,
      );
      setEditor(null);
      setNotice(editor.published ? "Grade saved and published." : "Grade saved as unpublished.");
      await loadGrades();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(grade) {
    const nextPublished = !grade.published;
    const action = nextPublished ? "Publish" : "Unpublish";
    if (
      !window.confirm(
        `${action} the grade for ${grade.student_name || "this student"} on ${grade.project_title || "this project"}?`,
      )
    ) {
      return;
    }
    setPublishingId(grade.id);
    setError("");
    try {
      await setInstructorGradePublished(grade.id, nextPublished);
      setNotice(nextPublished ? "Grade published." : "Grade unpublished.");
      await loadGrades();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPublishingId(null);
    }
  }

  async function publishAll() {
    if (!courseId) {
      setNotice("Select a course first.");
      return;
    }
    const scope = { course_id: Number(courseId) };
    if (projectId !== "all") scope.project_id = Number(projectId);
    if (
      !window.confirm(
        `Publish all eligible grades for the selected ${
          projectId === "all" ? "course" : "project"
        }? Published grades become visible to students.`,
      )
    ) {
      return;
    }
    setPublishingAll(true);
    setError("");
    setNotice("");
    try {
      const result = await publishAllInstructorGrades(scope);
      setNotice(
        `Published ${result.published_count} grade${
          result.published_count === 1 ? "" : "s"
        }.${
          result.skipped_count
            ? ` ${result.skipped_count} incomplete grade${
                result.skipped_count === 1 ? " was" : "s were"
              } skipped.`
            : ""
        }`,
      );
      await loadGrades();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPublishingAll(false);
    }
  }

  async function openHistory(grade) {
    setHistoryLoading(true);
    setError("");
    try {
      const data = await getInstructorGradeAudit(grade.id);
      setHistory(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  if (courseOptions.length === 0) {
    return (
      <div className="theme-card rounded-2xl border border-[#003C43]/10 bg-white p-6 text-sm text-[#587376]">
        Create a course before recording grades.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#003C43]">Grade Management</h2>
          <p className="mt-1 text-xs text-[#587376]">
            Record grades and written feedback, review audit history, and publish results to students.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="theme-control rounded-xl border border-[#135D66]/20 px-4 py-2.5 text-xs font-bold text-[#135D66] transition hover:bg-[#E3FEF7]"
          >
            Record grade
          </button>
          <button
            type="button"
            onClick={publishAll}
            disabled={publishingAll || !courseId}
            className="rounded-xl bg-[#135D66] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#003C43] disabled:opacity-60"
          >
            {publishingAll ? "Publishing..." : "Publish All"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#003C43]/10 bg-white p-4 sm:grid-cols-3">
        <label className="text-xs font-semibold text-[#365c60]">
          Course
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm"
          >
            {courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#365c60]">
          Project
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm"
          >
            <option value="all">All projects</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#365c60]">
          Student
          <select
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm"
          >
            <option value="all">All students</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && (
        <div className="rounded-xl bg-[#dff8f3] px-4 py-3 text-xs font-semibold text-[#135D66]" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-[#fff0f0] px-4 py-3 text-xs font-semibold text-[#a94646]" role="alert">
          {error}
        </div>
      )}
      {loading && <p className="text-xs text-[#6d898b]" role="status">Loading grades…</p>}

      <div className="overflow-x-auto rounded-2xl border border-[#003C43]/10 bg-white">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-[#003C43]/8 text-[#587376]">
            <tr>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Grade</th>
              <th className="px-4 py-3 font-semibold">Feedback</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#003C43]/8">
            {grades.map((grade) => (
              <tr key={grade.id} className="text-[#365c60]">
                <td className="px-4 py-3">
                  <p className="font-bold text-[#003C43]">{grade.student_name || "Student"}</p>
                  <p className="text-[10px] text-[#718b8d]">{grade.student_email}</p>
                </td>
                <td className="px-4 py-3">{grade.project_title || "Project"}</td>
                <td className="px-4 py-3 font-bold text-[#003C43]">
                  {grade.grade === null || grade.grade === undefined ? "—" : `${grade.grade} / ${grade.max_grade ?? 100}`}
                </td>
                <td className="max-w-[260px] px-4 py-3">
                  <span className="line-clamp-2">{grade.feedback || "No feedback"}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      grade.published
                        ? "bg-[#dff8f3] text-[#135D66]"
                        : "bg-[#fff4d6] text-[#8a6210]"
                    }`}
                  >
                    {grade.published ? "Published" : "Unpublished"}
                  </span>
                  {grade.published_at && (
                    <p className="mt-1 text-[10px] text-[#718b8d]">{formatDate(grade.published_at)}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-[#718b8d]">{formatDate(grade.updated_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(grade)}
                      className="rounded-lg border border-[#003C43]/15 px-2.5 py-1 font-bold text-[#135D66] transition hover:bg-[#E3FEF7]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openHistory(grade)}
                      className="rounded-lg border border-[#003C43]/15 px-2.5 py-1 font-bold text-[#135D66] transition hover:bg-[#E3FEF7]"
                    >
                      History
                    </button>
                    <button
                      type="button"
                      disabled={publishingId === grade.id}
                      onClick={() => togglePublish(grade)}
                      className="rounded-lg bg-[#E3FEF7] px-2.5 py-1 font-bold text-[#135D66] transition hover:bg-[#dff8f3] disabled:opacity-60"
                    >
                      {publishingId === grade.id ? "Saving…" : grade.published ? "Unpublish" : "Publish"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && grades.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-[#718b8d]">
                  No grades recorded for these filters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editor && (
        <Modal
          title={editor.gradeId ? "Edit grade" : "Record grade"}
          onClose={() => setEditor(null)}
        >
          <form onSubmit={saveGrade} className="space-y-4">
            <label className="block text-xs font-semibold text-[#365c60]">
              Student
              <select
                value={editor.studentId}
                onChange={(event) => setEditor({ ...editor, studentId: event.target.value })}
                disabled={Boolean(editor.gradeId)}
                className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm disabled:opacity-60"
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#365c60]">
              Project
              <select
                value={editor.projectId}
                onChange={(event) => setEditor({ ...editor, projectId: event.target.value })}
                disabled={Boolean(editor.gradeId)}
                className="mt-1 w-full rounded-lg border border-[#003C43]/15 bg-white p-2.5 text-sm disabled:opacity-60"
              >
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#365c60]">
              Grade (0–{maxGradeFor(editor.projectId)})
              <input
                type="number"
                step="0.01"
                min="0"
                max={maxGradeFor(editor.projectId)}
                required
                value={editor.grade}
                onChange={(event) => setEditor({ ...editor, grade: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-[#365c60]">
              Written feedback
              <textarea
                rows="4"
                value={editor.feedback}
                onChange={(event) => setEditor({ ...editor, feedback: event.target.value })}
                placeholder="Explain the result and next steps for this student."
                className="mt-1 w-full rounded-lg border border-[#003C43]/15 p-2.5 text-sm"
              />
            </label>
            {editor.gradeId && (
              <p className="rounded-lg bg-[#fff4d6] px-3 py-2 text-xs text-[#8a6210]">
                Changes start unpublished by default. Check Publish only when this version is ready for the student.
              </p>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-[#365c60]">
              <input
                type="checkbox"
                checked={editor.published}
                onChange={(event) => setEditor({ ...editor, published: event.target.checked })}
              />
              Publish now
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg border border-[#003C43]/15 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#135D66] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save grade"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {historyLoading && <p className="text-xs text-[#6d898b]" role="status">Loading grade history…</p>}
      {history && (
        <Modal title="Grade history" onClose={() => setHistory(null)} wide>
          <div className="space-y-3">
            <p className="text-xs text-[#587376]">
              {history.grade?.student_name} · {history.grade?.project_title}
            </p>
            {history.audits.length === 0 && (
              <p className="text-xs text-[#718b8d]">No changes recorded yet.</p>
            )}
            {history.audits.map((audit) => (
              <div key={audit.id} className="rounded-xl border border-[#003C43]/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#003C43]">
                    {audit.changed_by_name || "Unknown instructor"}
                  </p>
                  <p className="text-[10px] text-[#718b8d]">{formatDate(audit.changed_at)}</p>
                </div>
                <p className="mt-2 text-xs text-[#365c60]">
                  Grade: {audit.old_grade ?? "—"} → {audit.new_grade ?? "—"}
                </p>
                {audit.old_feedback !== audit.new_feedback && (
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    <p className="rounded-lg bg-[#f0f7f6] p-2 text-[#587376]">
                      Before: {audit.old_feedback || "No feedback"}
                    </p>
                    <p className="rounded-lg bg-[#dff8f3] p-2 text-[#135D66]">
                      After: {audit.new_feedback || "No feedback"}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
