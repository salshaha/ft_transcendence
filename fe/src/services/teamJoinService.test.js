import { beforeEach, describe, expect, it, vi } from "vitest";

const joinStudentTeam = vi.fn();
const switchStudentTeam = vi.fn();

vi.mock("./studentService", () => ({
  joinStudentTeam,
  switchStudentTeam,
}));

describe("team join service", () => {
  beforeEach(() => {
    joinStudentTeam.mockReset();
    switchStudentTeam.mockReset();
  });

  it("uses course page team data for a normal join", async () => {
    const { completeTeamJoin } = await import("./teamJoinService");
    const teams = [
      {
        id: 7,
        requires_leave_current_team: false,
        already_in_project: false,
      },
    ];

    const message = await completeTeamJoin(7, teams);

    expect(joinStudentTeam).toHaveBeenCalledWith(7);
    expect(switchStudentTeam).not.toHaveBeenCalled();
    expect(message).toBe("You joined the team.");
  });

  it("uses course page team data for a leave-and-join switch", async () => {
    const { completeTeamJoin } = await import("./teamJoinService");
    const teams = [
      {
        id: 9,
        requires_leave_current_team: true,
        already_in_project: false,
      },
    ];

    const message = await completeTeamJoin(9, teams);

    expect(switchStudentTeam).toHaveBeenCalledWith(9);
    expect(joinStudentTeam).not.toHaveBeenCalled();
    expect(message).toBe("You switched to the new team.");
  });

  it("falls back to preview team metadata when page teams are not loaded", async () => {
    const { completeTeamJoin } = await import("./teamJoinService");

    await completeTeamJoin(
      11,
      null,
      { id: 11, requires_leave_current_team: true },
    );

    expect(switchStudentTeam).toHaveBeenCalledWith(11);
    expect(joinStudentTeam).not.toHaveBeenCalled();
  });
});
