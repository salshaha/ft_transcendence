import { joinStudentTeam, switchStudentTeam } from "./studentService";

export function findTeamForJoin(teamId, sourceTeams, previewTeam = null) {
  const teams = Array.isArray(sourceTeams) ? sourceTeams : [];
  return (
    teams.find((item) => String(item.id) === String(teamId)) ||
    (String(previewTeam?.id) === String(teamId) ? previewTeam : null)
  );
}

export async function completeTeamJoin(teamId, sourceTeams, previewTeam = null) {
  const team = findTeamForJoin(teamId, sourceTeams, previewTeam);
  const shouldSwitch = Boolean(
    team?.requires_leave_current_team || team?.already_in_project,
  );
  if (shouldSwitch) {
    await switchStudentTeam(teamId);
    return "You switched to the new team.";
  }
  await joinStudentTeam(teamId);
  return "You joined the team.";
}
