import { formatBytes, formatDate, statusTone } from "./formatters"

export default function SubmissionTimeline({ submissions, onView, onDownload, onOpen }) {
  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute bottom-2 left-[9px] top-2 w-px bg-[#003C43]/12" aria-hidden="true" />
      {submissions.map((submission) => (
        <article key={submission.id} className="relative rounded-2xl border border-[#003C43]/8 bg-[#f7fbfa] p-4">
          <span className="absolute -left-[21px] top-6 h-3 w-3 rounded-full border-2 border-white bg-[#135D66] shadow" aria-hidden="true" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen?.(submission)}
                className="text-left text-sm font-bold text-[#003C43] hover:underline"
              >
                {submission.team_name || "Team"} · {submission.project_title || "Project"}
              </button>
              <div className="mt-1 text-[11px] text-[#718b8d]">
                {submission.course_name} · by {submission.submitter_name || "Unknown"}
              </div>
            </div>
            <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${statusTone(submission.status)}`}>
              {submission.status.replaceAll("_", " ")}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-[#587376]">
              <div>Submitted {formatDate(submission.submitted_at)}</div>
              <div className="mt-0.5">Deadline {formatDate(submission.deadline)}</div>
              <div className="mt-0.5">{submission.file.original_name} · {formatBytes(submission.file.size)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onView?.(submission)} className="rounded-lg bg-[#E3FEF7] px-3 py-2 text-[10px] font-bold text-[#135D66] transition hover:bg-[#77B0AA] hover:text-[#003C43]">
                Preview
              </button>
              <button type="button" onClick={() => onDownload?.(submission)} className="rounded-lg border border-[#135D66]/20 px-3 py-2 text-[10px] font-bold text-[#135D66] transition hover:bg-white">
                Download
              </button>
            </div>
          </div>
        </article>
      ))}
      {submissions.length === 0 && (
        <p className="rounded-xl bg-[#f0f7f6] p-4 text-xs text-[#718b8d]">No submissions have been uploaded yet.</p>
      )}
    </div>
  );
}
