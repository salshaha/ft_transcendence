import { useState } from "react";
import Modal from "../instructor/Modal";
import StudentPublicProfileModal from "./StudentPublicProfileModal";
import TeamMemberCard from "./TeamMemberCard";
import { getStudentPublicProfile } from "../../services/studentService";

export default function TeamPreviewModal({
  team,
  presence,
  currentUserId,
  onClose,
  onJoin,
  onLeave,
  onRemoveMember,
  onTransferLeadership,
}) {
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [memberProfile, setMemberProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const canManage = currentUserId && team?.leader_id === currentUserId;

  async function confirm() {
    setBusy(true);
    setActionError("");
    try {
      if (confirmAction === "leave") {
        await onLeave(team.id);
        onClose();
      } else if (confirmAction?.type === "remove") {
        await onRemoveMember(team.id, confirmAction.memberId);
        setConfirmAction(null);
      } else if (confirmAction?.type === "transfer") {
        await onTransferLeadership(team.id, confirmAction.memberId);
        setConfirmAction(null);
      } else {
        await onJoin(team.id);
        onClose();
      }
    } catch (requestError) {
      setActionError(requestError.message || "Unable to update your team.");
    } finally {
      setBusy(false);
    }
  }

  async function openMemberProfile(member) {
    const memberId = member.profile_user_id || member.id;
    setMemberProfile(null);
    setProfileError("");
    setProfileLoading(true);
    try {
      const result = await getStudentPublicProfile(memberId);
      setMemberProfile(result.student);
    } catch (requestError) {
      setProfileError(requestError.message || "Unable to load this profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <Modal
      title={team.name}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#77B0AA]/35 bg-[#f5faf9] p-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-[#77B0AA]">
              {team.project?.course?.name || "Course"}
            </div>
            <div className="mt-1 text-lg font-black text-[#003C43]">
              {team.project?.title || team.project?.name || "Project team"}
            </div>
            <div className="mt-1 text-xs text-[#718b8d]">
              {team.description || "No team description provided."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-xl bg-white px-3 py-1.5 text-[#135D66] shadow-sm">
              {team.status || "forming"}
            </span>
              <span className="rounded-xl bg-white px-3 py-1.5 text-[#135D66] shadow-sm">
                {team.current_member_count || 0}/{team.max_members || 0} members
              </span>
              <span className="rounded-xl bg-white px-3 py-1.5 text-[#135D66] shadow-sm">
                Min {team.min_members || 1} · {team.available_spots || 0} open
              </span>
          </div>
        </div>

        {team.project?.deadline ? (
          <div className="text-xs font-semibold text-[#718b8d]">
            Project deadline: {new Date(team.project.deadline).toLocaleString()}
          </div>
        ) : null}

        <div>
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#77B0AA]">
            Team members
          </h3>
          {(team.members || []).length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(team.members || []).map((member) => (
                <TeamMemberCard
                  key={member.profile_user_id || member.id}
                  member={member}
                  isLeader={team.leader_id === (member.profile_user_id || member.id)}
                  presence={presence}
                  onProfile={openMemberProfile}
                >
                  {canManage && (member.profile_user_id || member.id) !== currentUserId ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: "transfer", memberId: member.profile_user_id || member.id, name: member.full_name || member.name })}
                        className="rounded-lg border border-[#135D66]/30 px-2 py-1 text-[10px] font-bold text-[#135D66] hover:bg-[#E3FEF7]"
                      >
                        Make leader
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: "remove", memberId: member.profile_user_id || member.id, name: member.full_name || member.name })}
                        className="rounded-lg border border-[#dc2626]/30 px-2 py-1 text-[10px] font-bold text-[#dc2626] hover:bg-[#fee2e2]"
                      >
                        Remove
                      </button>
                    </>
                  ) : null}
                </TeamMemberCard>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#77B0AA]/50 bg-[#f5faf9] px-4 py-6 text-center text-xs text-[#718b8d]">
              This team has no members yet. You can be the first to join.
            </div>
          )}
        </div>

        {actionError ? (
          <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]">
            {actionError}
          </div>
        ) : null}

        {confirmAction ? (
          <div className="rounded-2xl border border-[#135D66]/25 bg-[#E3FEF7] p-4">
            <div className="text-sm font-bold text-[#003C43]">
              {confirmAction === "leave"
                ? "Leave this team?"
                : confirmAction?.type === "remove"
                  ? `Remove ${confirmAction.name}?`
                  : confirmAction?.type === "transfer"
                    ? `Make ${confirmAction.name} the team leader?`
                    : "Join this team?"}
            </div>
            <p className="mt-1 text-xs text-[#718b8d]">
              {confirmAction === "leave"
                ? "If you leave, the team may fall below the minimum required size. Leaving is blocked if the project deadline has passed or the project has been submitted."
                : confirmAction?.type === "remove"
                  ? "This member will be removed from the team. This is blocked after deadline/submission or when the team is locked."
                  : confirmAction?.type === "transfer"
                    ? "Leadership will be transferred to this member. You will remain a regular team member."
                    : team.requires_leave_current_team
                      ? "You must leave your current team for this project before joining. Backend rules will enforce this."
                      : "You will become a member of this team."}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-[#003C43]/15 px-3 py-1.5 text-xs font-bold text-[#003C43]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 ${
                  confirmAction === "leave"
                    ? "bg-[#dc2626] hover:bg-[#991b1b]"
                    : "bg-[#135D66] hover:bg-[#003C43]"
                }`}
              >
                {busy
                  ? "Please wait..."
                  : confirmAction === "leave"
                    ? "Confirm Leave"
                    : confirmAction?.type === "remove"
                      ? "Confirm Remove"
                      : confirmAction?.type === "transfer"
                        ? "Confirm Transfer"
                        : "Confirm Join"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#003C43]/8 pt-4">
            {team.is_member ? (
              <button
                type="button"
                onClick={() => setConfirmAction("leave")}
                className="rounded-xl border border-[#dc2626]/30 px-4 py-2 text-sm font-bold text-[#dc2626] transition hover:bg-[#fee2e2]"
              >
                Leave Team
              </button>
            ) : team.can_join_after_leaving !== false ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction("join")}
                  className="rounded-xl bg-[#135D66] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#135D66]/20 transition hover:bg-[#003C43]"
                >
                  {team.requires_leave_current_team ? "Leave current team to join" : "Join Team"}
                </button>
                {team.requires_leave_current_team ? (
                  <span className="text-xs text-[#718b8d]">
                    {team.join_blocked_reason}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl bg-[#f5faf9] px-4 py-2 text-xs font-semibold text-[#718b8d]">
                {team.join_blocked_reason || "This team is not available to join."}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#003C43]/15 px-4 py-2 text-sm font-bold text-[#003C43] transition hover:bg-[#E3FEF7]"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {memberProfile ? (
        <StudentPublicProfileModal
          student={memberProfile}
          loading={profileLoading}
          error={profileError}
          onClose={() => setMemberProfile(null)}
        />
      ) : null}
    </Modal>
  );
}
