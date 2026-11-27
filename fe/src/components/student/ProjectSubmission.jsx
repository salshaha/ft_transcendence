import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "../instructor/Modal";
import { formatBytes, formatDate, statusTone } from "../instructor/formatters";
import { useTeamRealtime } from "../../hooks/useTeamRealtime";
import { API_URL } from "../../services/apiClient";
import { saveFileBlob } from "../../services/instructorService";
import * as studentService from "../../services/studentService";

export default function ProjectSubmission({ teamId, project, onSubmitted }) {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(Boolean(teamId));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);
  const uploadControllerRef = useRef(null);

  const rules = project?.submission_file_rules || {};
  const extensions = Array.isArray(rules.accepted_extensions)
    ? rules.accepted_extensions
    : [];
  const mimeTypes = Array.isArray(rules.accepted_mime_types)
    ? rules.accepted_mime_types
    : [];
  const maxBytes = Number(rules.max_size_bytes) || 100 * 1024 * 1024;
  const accept = [...extensions.map((item) => `.${item}`), ...mimeTypes].join(",");
  const deadline = project?.deadline || null;
  const deadlinePassed = Boolean(
    deadline && new Date(deadline).getTime() < Date.now(),
  );

  const loadSubmission = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await studentService.getTeamSubmission(teamId);
      setSubmission(data.submission || null);
    } catch (requestError) {
      setError(requestError.message || "Unable to load the team submission.");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    setLoading(Boolean(teamId));
    setError("");
    setSubmission(null);
    loadSubmission();
  }, [loadSubmission]);

  useTeamRealtime(teamId ? [teamId] : [], (event) => {
    if (event === "submission_updated") loadSubmission();
  });

  function validateSelected(selected) {
    const extension = selected.name.split(".").pop().toLowerCase();
    if (extensions.length && !extensions.includes(extension)) {
      return `Unsupported file type. Allowed: ${extensions
        .map((item) => `.${item}`)
        .join(", ")}`;
    }
    if (mimeTypes.length && selected.type && !mimeTypes.includes(selected.type)) {
      return `Unsupported file type. Allowed: ${mimeTypes.join(", ")}`;
    }
    if (selected.size > maxBytes) {
      return `File is larger than the ${formatBytes(maxBytes)} limit.`;
    }
    return "";
  }

  function handleFileChange(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setProgress(0);
    setMessage("");
    setError(selected ? validateSelected(selected) : "");
  }

  function removeFile() {
    setFile(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || uploading || !teamId) return;
    const validation = validateSelected(file);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setProgress(0);
    setError("");
    setMessage("");
    try {
      const data = await studentService.submitTeamProject(teamId, file, setProgress);
      setSubmission(data.submission || null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Your team's project was submitted successfully.");
      onSubmitted?.(data.submission);
    } catch (requestError) {
      setError(requestError.message || "Unable to submit project work.");
    } finally {
      setUploading(false);
    }
  }

  async function openSubmission(download) {
    if (!teamId) return;
    setError("");
    try {
      const { blob } = await studentService.fetchTeamSubmissionFile(teamId, download);
      if (download) {
        saveFileBlob(blob, submission?.file?.original_name || "submission");
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      setError(requestError.message || "Unable to open the submitted file.");
    }
  }

  return (
    <section className="theme-surface mt-6 rounded-2xl border border-[#003C43]/8 bg-white p-5 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#003C43]">Project submission</h2>
          <p className="mt-1 text-xs text-[#6d898b]">
            Upload your team's final work and track its submission status.
          </p>
        </div>
        <div className="theme-soft rounded-xl px-3 py-2 text-right">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#77B0AA]">
            Deadline
          </div>
          <div className="text-xs font-bold text-[#003C43]">
            {deadline ? formatDate(deadline) : "Not set"}
          </div>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-[#E3FEF7] p-3 text-xs text-[#135D66]" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-[#fff0f0] p-3 text-xs text-[#a94646]" role="alert">
          {error}
        </p>
      )}

      {!teamId ? (
        <p className="theme-soft mt-4 rounded-xl p-4 text-xs text-[#587376]">
          Join or create a team for this project to submit your work.
        </p>
      ) : (
        <>
          <div className="theme-soft mt-5 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#003C43]">
                Submission status
              </h3>
              {submission && (
                <span
                  className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${statusTone(submission.status)}`}
                >
                  {submission.status.replaceAll("_", " ")}
                </span>
              )}
            </div>
            {loading ? (
              <p className="mt-3 text-xs text-[#718b8d]">Loading submission...</p>
            ) : !submission ? (
              <p className="mt-3 text-xs text-[#718b8d]">
                No submission has been uploaded by your team yet.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 text-xs text-[#365c60] sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold text-[#77B0AA]">
                    Submitted at
                  </div>
                  <div className="font-semibold">
                    {formatDate(submission.submitted_at)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#77B0AA]">
                    Submitted by
                  </div>
                  <div className="font-semibold">
                    {submission.submitter?.name || "Team member"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#77B0AA]">
                    File
                  </div>
                  <div className="break-all font-semibold">
                    {submission.file?.original_name || "—"}
                  </div>
                  <div className="text-[10px] text-[#718b8d]">
                    {formatBytes(submission.file?.size)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#77B0AA]">
                    Timing
                  </div>
                  <div className="font-semibold">
                    {submission.on_time ? "On time" : "Late"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => openSubmission(false)}
                    className="theme-control rounded-lg border px-3 py-2 text-[10px] font-bold text-[#135D66]"
                  >
                    View submitted file
                  </button>
                  <button
                    type="button"
                    onClick={() => openSubmission(true)}
                    className="theme-control rounded-lg border px-3 py-2 text-[10px] font-bold text-[#135D66]"
                  >
                    Download file
                  </button>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 rounded-xl border border-[#003C43]/10 p-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#003C43]">
              {submission ? "Replace submission" : "Upload submission"}
            </h3>
            <p className="mt-2 text-[11px] text-[#718b8d]">
              Accepted types:{" "}
              <span className="font-semibold text-[#365c60]">
                {extensions.length
                  ? extensions.map((item) => `.${item}`).join(", ")
                  : "PDF, images, archives, Office documents, and text files"}
              </span>
              . Maximum size: {formatBytes(maxBytes)}.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="theme-control cursor-pointer rounded-lg border border-[#003C43]/15 px-3 py-2 text-xs font-bold text-[#135D66]">
                {file ? "Replace file" : "Choose file"}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={extensions.length ? extensions.map((item) => `.${item}`).join(",") : undefined}
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
              {file && (
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-semibold text-[#365c60]">
                    {file.name} ({formatBytes(file.size)})
                  </span>
                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={uploading}
                    className="text-[10px] font-bold text-[#a94646] hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {uploading && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[10px] font-bold text-[#135D66]">
                  <span>Uploading...</span>
                  <span>{progress}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-[#003C43]/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className="h-full rounded-full bg-[#135D66] transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={
                  uploading || !file || deadlinePassed || Boolean(validateSelected(file))
                }
                className="rounded-lg bg-[#135D66] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#003C43] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading
                  ? "Submitting..."
                  : submission
                    ? "Replace submission"
                    : "Submit project"}
              </button>
              {deadlinePassed && (
                <span className="text-[11px] font-semibold text-[#a94646]">
                  The deadline has passed. Late submissions are not allowed.
                </span>
              )}
            </div>
          </form>
        </>
      )}
    </section>
  );
}
