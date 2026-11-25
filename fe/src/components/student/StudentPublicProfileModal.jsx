import Modal from "../instructor/Modal";
import Avatar from "./Avatar";
import { proficiencyLabel } from "./studentFormatters";

export default function StudentPublicProfileModal({
  student,
  loading,
  error,
  onClose,
}) {
  return (
    <Modal
      title={student?.full_name || "Student profile"}
      onClose={onClose}
    >
      {loading ? (
        <div className="grid place-items-center py-10 text-sm font-semibold text-[#718b8d]">
          Loading profile...
        </div>
      ) : error ? (
        <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]">
          {error}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar user={student} className="h-16 w-16" />
            <div>
              <div className="text-lg font-black text-[#003C43]">
                {student?.full_name}
              </div>
              <div className="text-xs text-[#718b8d]">
                {student?.major || student?.domain || "Student"}
              </div>
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#77B0AA]">
              Skills
            </h4>
            <div className="flex flex-wrap gap-2">
              {(student?.skills || []).map((skill) => (
                <span
                  key={skill.skill_id || skill.id || skill.name}
                  className="rounded-xl bg-[#f5faf9] px-2.5 py-1.5 text-xs font-semibold text-[#003C43]"
                >
                  {skill.name} ·{" "}
                  {skill.proficiency_label || proficiencyLabel(skill.proficiency_level)}
                </span>
              ))}
              {(student?.skills || []).length === 0 ? (
                <span className="text-xs text-[#9ca3af]">No skills listed.</span>
              ) : null}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#77B0AA]">
              Shared courses
            </h4>
            <div className="flex flex-wrap gap-2">
              {(student?.courses || []).map((course) => (
                <span
                  key={course.id}
                  className="rounded-xl bg-[#E3FEF7] px-2.5 py-1.5 text-xs font-bold text-[#135D66]"
                >
                  {course.name}
                </span>
              ))}
            </div>
          </div>
          {student?.current_project ? (
            <div className="rounded-2xl border border-[#003C43]/8 bg-[#f5faf9] p-4 text-xs text-[#718b8d]">
              Current project:{" "}
              <span className="font-bold text-[#003C43]">
                {student.current_project.title}
              </span>
              {student.current_project.team ? (
                <> · Team: {student.current_project.team.name}</>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
