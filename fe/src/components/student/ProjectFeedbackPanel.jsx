import { useCallback, useEffect, useState } from "react";
import { formatDate } from "../instructor/formatters";
import { useRealtimeEvent } from "../../hooks/useTeamRealtime";
import {
  getMyPeerFeedback,
  getStudentGrades,
  savePeerFeedback,
} from "../../services/studentService";

export default function ProjectFeedbackPanel({
  project,
  teamId,
  teammates = [],
  currentUserId,
}) {
  const [grades, setGrades] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  const projectId = project?.id;
  const rules = project?.peer_feedback_rules || {};
  const minRating = Number(rules.min_rating) || 1;
  const maxRating = Number(rules.max_rating) || 5;
  const maxLength = Number(rules.max_feedback_length) || 2000;
  const deadlinePassed = Boolean(
    project?.deadline && new Date(project.deadline).getTime() <= Date.now(),
  );
  const feedbackAvailable =
    project?.peer_feedback_available === undefined
      ? deadlinePassed
      : Boolean(project.peer_feedback_available);
  const eligibleTeammates = teammates.filter(
    (member) =>
      member.id &&
      !member.is_viewer &&
      Number(member.id) !== Number(currentUserId),
  );
  const grade = grades.find((item) => item.project_id === projectId);
  const selectedItem = feedbackItems.find(
    (item) => Number(item.to_student_id) === Number(selectedId),
  );

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setGradeError("");
    setFeedbackError("");
    try {
      const data = await getStudentGrades();
      setGrades(Array.isArray(data.grades) ? data.grades : []);
    } catch (error) {
      setGradeError(error.message || "Unable to load your grades.");
    }
    try {
      const data = await getMyPeerFeedback(projectId);
      setFeedbackItems(Array.isArray(data.peer_feedback) ? data.peer_feedback : []);
    } catch (error) {
      setFeedbackError(error.message || "Unable to load your peer feedback.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setGrades([]);
    setFeedbackItems([]);
    setMessage("");
    setSubmitError("");
    load();
  }, [load]);

  useRealtimeEvent("grade_published", (payload) => {
    if (payload?.project_id === projectId) load();
  });

  function handleRecipientChange(event) {
    const nextId = event.target.value;
    setSelectedId(nextId);
    const existing = feedbackItems.find(
      (item) => Number(item.to_student_id) === Number(nextId),
    );
    setRating(existing?.rating ?? "");
    setComment(existing?.feedback ?? "");
    setSubmitError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedId || saving) return;
    const numericRating = Number(rating);
    const trimmedComment = String(comment || "").trim();
    if (
      !Number.isInteger(numericRating) ||
      numericRating < minRating ||
      numericRating > maxRating
    ) {
      setSubmitError(`Choose a rating from ${minRating} to ${maxRating}.`);
      return;
    }
    if (!trimmedComment) {
      setSubmitError("Written feedback is required.");
      return;
    }
    if (trimmedComment.length > maxLength) {
      setSubmitError(`Feedback must be at most ${maxLength} characters.`);
      return;
    }

    setSaving(true);
    setSubmitError("");
    setMessage("");
    try {
      await savePeerFeedback({
        projectId,
        toStudentId: Number(selectedId),
        rating: numericRating,
        feedback: trimmedComment,
      });
      setMessage(
        selectedItem
          ? "Your peer feedback was updated."
          : "Your peer feedback was submitted.",
      );
      await load();
    } catch (error) {
      setSubmitError(error.message || "Unable to save peer feedback.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="theme-surface mt-6 rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-[#003C43]">Grades and feedback</h2>
        <p className="mt-1 text-xs text-[#6d898b]">
          Your published project grade, instructor feedback, and peer reviews.
        </p>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-[#E3FEF7] p-3 text-xs text-[#135D66]" role="status">
          {message}
        </p>
      )}
      {(gradeError || feedbackError || submitError) && (
        <div className="mt-4 space-y-2">
          {gradeError && (
            <p className="rounded-xl bg-[#fff0f0] p-3 text-xs text-[#a94646]" role="alert">
              {gradeError}
            </p>
          )}
          {feedbackError && (
            <p className="rounded-xl bg-[#fff0f0] p-3 text-xs text-[#a94646]" role="alert">
              {feedbackError}
            </p>
          )}
          {submitError && (
            <p className="rounded-xl bg-[#fff0f0] p-3 text-xs text-[#a94646]" role="alert">
              {submitError}
            </p>
          )}
        </div>
      )}

      <div className="theme-soft mt-5 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#003C43]">
            Instructor grade and feedback
          </h3>
          {grade && (
            <span className="rounded-md bg-[#E3FEF7] px-2 py-1 text-[10px] font-bold uppercase text-[#135D66]">
              Published
            </span>
          )}
        </div>
        {loading ? (
          <p className="mt-3 text-xs text-[#718b8d]">Loading grades and feedback...</p>
        ) : !grade ? (
          <p className="mt-3 text-xs text-[#718b8d]">
            Your instructor has not published a grade for this project yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 text-xs text-[#365c60] sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-semibold text-[#77B0AA]">Grade</div>
              <div className="text-lg font-extrabold text-[#003C43]">
                {grade.grade === null || grade.grade === undefined
                  ? "Not graded"
                  : grade.grade}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-[#77B0AA]">
                Published at
              </div>
              <div className="font-semibold">
                {formatDate(grade.published_at || grade.updated_at)}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[10px] font-semibold text-[#77B0AA]">
                Instructor feedback
              </div>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-white/70 p-3 font-medium leading-5">
                {grade.feedback || "No written instructor feedback was provided."}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-[#003C43]/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#003C43]">
            Peer feedback
          </h3>
          {feedbackItems.length > 0 && (
            <span className="rounded-full bg-[#E3FEF7] px-2.5 py-1 text-[10px] font-bold text-[#135D66]">
              {feedbackItems.length} submitted
            </span>
          )}
        </div>

        {!feedbackAvailable ? (
          <p className="mt-3 rounded-lg bg-[#f0f7f6] p-3 text-xs text-[#587376]">
            Peer feedback becomes available after the project deadline has passed.
          </p>
        ) : !teamId ? (
          <p className="mt-3 rounded-lg bg-[#f0f7f6] p-3 text-xs text-[#587376]">
            Join or create a team for this project to review your teammates.
          </p>
        ) : eligibleTeammates.length === 0 ? (
          <p className="mt-3 rounded-lg bg-[#f0f7f6] p-3 text-xs text-[#587376]">
            There are no eligible teammates to review yet.
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="mt-3 grid gap-3">
              <label className="grid gap-1 text-[11px] font-bold text-[#365c60]">
                Teammate
                <select
                  aria-label="Teammate to review"
                  className="theme-control rounded-lg border px-3 py-2 text-xs"
                  value={selectedId}
                  onChange={handleRecipientChange}
                >
                  <option value="">Select a teammate</option>
                  {eligibleTeammates.map((member) => {
                    const submitted = feedbackItems.some(
                      (item) => Number(item.to_student_id) === Number(member.id),
                    );
                    return (
                      <option key={member.id} value={member.id}>
                        {member.name || member.full_name || `Student ${member.id}`}
                        {submitted ? " (already submitted)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#365c60]">
                Rating ({minRating}–{maxRating})
                <select
                  aria-label="Peer rating"
                  className="theme-control rounded-lg border px-3 py-2 text-xs"
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                >
                  <option value="">Select a rating</option>
                  {Array.from({ length: maxRating - minRating + 1 }, (_, index) => {
                    const value = minRating + index;
                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#365c60]">
                Written feedback
                <textarea
                  aria-label="Peer feedback comment"
                  className="theme-control min-h-24 rounded-lg border px-3 py-2 text-xs"
                  value={comment}
                  maxLength={maxLength}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Describe their contribution and collaboration."
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !selectedId}
                  className="rounded-lg bg-[#135D66] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#003C43] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : selectedItem
                      ? "Update feedback"
                      : "Submit feedback"}
                </button>
                <span className="text-[10px] text-[#718b8d]">
                  {comment.length}/{maxLength} characters
                </span>
              </div>
            </form>

            {feedbackItems.length > 0 && (
              <div className="mt-4 border-t border-[#003C43]/10 pt-4">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-[#003C43]">
                  Feedback you submitted
                </h4>
                <div className="mt-2 space-y-2">
                  {feedbackItems.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setSelectedId(String(item.to_student_id));
                        setRating(item.rating ?? "");
                        setComment(item.feedback || "");
                      }}
                      className="theme-soft block w-full rounded-lg p-3 text-left transition hover:bg-[#e3fef7]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-[#003C43]">
                          {item.recipient?.name || `Student ${item.to_student_id}`}
                        </span>
                        <span className="font-bold text-[#135D66]">
                          {item.rating}/5 · {formatDate(item.updated_at || item.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-[#587376]">
                        {item.feedback}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
