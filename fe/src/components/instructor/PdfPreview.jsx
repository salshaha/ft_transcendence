import { useEffect, useState } from "react"
import Modal from "./Modal"
import { downloadInstructorProjectRequirements, fetchInstructorFile } from "../../services/instructorService"

export default function PdfPreview({ project, onClose }) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    let objectUrl = ""
    setError("")
    fetchInstructorFile(`/api/instructor/projects/${project.id}/requirements`, "Unable to preview this PDF.")
      .then(({ blob }) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [project.id])

  return (
    <Modal wide title={`Requirements · ${project.requirements?.original_name || "PDF preview"}`} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#718b8d]">
          Preview streamed from the server. Only your course can access this file.
        </p>
        <button
          type="button"
          onClick={() => downloadInstructorProjectRequirements(project.id, project.requirements?.original_name).catch((requestError) => setError(requestError.message))}
          className="rounded-lg bg-[#135D66] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#003C43]"
        >
          Download PDF
        </button>
      </div>
      {error ? (
        <p className="rounded-xl bg-[#fdece6] p-4 text-sm text-[#a94646]" role="alert">{error}</p>
      ) : url ? (
        <iframe
          src={url}
          title="Project requirements PDF"
          className="h-[65vh] w-full rounded-xl border border-[#003C43]/10 bg-white"
        />
      ) : (
        <div className="grid h-[45vh] place-items-center rounded-xl bg-[#f0f7f6] text-sm text-[#718b8d]" role="status">
          Loading PDF preview…
        </div>
      )}
    </Modal>
  )
}
