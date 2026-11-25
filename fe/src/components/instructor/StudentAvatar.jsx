import { useEffect, useState } from "react"
import {
  fetchInstructorFile,
  instructorStudentAvatarUrl,
} from "../../services/instructorService"

export default function StudentAvatar({ student, className = "h-11 w-11" }) {
  const [src, setSrc] = useState("")

  useEffect(() => {
    if (!student.profile_picture) {
      setSrc("")
      return undefined
    }
    let active = true
    let objectUrl = ""
    fetchInstructorFile(instructorStudentAvatarUrl(student.id), "Unable to load avatar.")
      .then(({ blob }) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (active) setSrc("")
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [student.id, student.profile_picture])

  const initials = `${student.first_name?.[0] || ""}${student.last_name?.[0] || ""}`
    .trim()
    .toUpperCase()
    .slice(0, 2) || "ST"

  if (src) {
    return (
      <img
        src={src}
        alt={`${student.full_name || "Student"} profile`}
        className={`${className} shrink-0 rounded-xl border border-[#003C43]/10 object-cover`}
      />
    )
  }

  return (
    <div className={`${className} grid shrink-0 place-items-center rounded-xl bg-[#E3FEF7] text-xs font-extrabold text-[#003C43]`}>
      {initials}
    </div>
  )
}
