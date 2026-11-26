import Avatar from "./Avatar";
import { formatLastSeen, proficiencyLabel, resolvePresence } from "./studentFormatters";

export default function TeamMemberCard({
  member,
  isLeader,
  presence,
  onProfile,
  children,
}) {
  const memberPresence = resolvePresence(presence, member);
  return (
    <div className="rounded-2xl border border-[#003C43]/8 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar user={member} showPresence presence={memberPresence} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[#003C43]">
            {member.full_name || member.name}
            {isLeader ? (
              <span className="ml-2 rounded-lg bg-[#E3FEF7] px-2 py-0.5 text-[10px] font-extrabold text-[#135D66]">
                Leader
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11px] text-[#718b8d]">
            {member.major || member.domain || "Student"}
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#135D66]">
            {memberPresence.online
              ? "Online now"
              : formatLastSeen(memberPresence.last_seen)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onProfile(member)}
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-[#135D66] underline underline-offset-2 hover:bg-[#E3FEF7]"
        >
          Profile
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(member.skills || []).map((skill) => (
          <span
            key={skill.skill_id || skill.id || skill.name}
            className="rounded-lg bg-[#f5faf9] px-2 py-1 text-[10px] font-bold text-[#003C43]"
          >
            {skill.name} ·{" "}
            {skill.proficiency_label || proficiencyLabel(skill.proficiency_level)}
          </span>
        ))}
        {(member.skills || []).length === 0 ? (
          <span className="text-[11px] text-[#9ca3af]">No skills listed.</span>
        ) : null}
      </div>
      {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
