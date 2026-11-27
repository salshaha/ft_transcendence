import { beforeEach, describe, expect, it, vi } from "vitest";

describe("student service file URLs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:8080" },
    });
  });

  it("uses the current origin for project requirements", async () => {
    const { studentProjectRequirementsUrl } = await import("./studentService");
    expect(studentProjectRequirementsUrl(16, { download: true })).toBe(
      "http://localhost:8080/api/student/projects/16/requirements?download=1",
    );
  });

  it("returns a relative submission URL for fetchInstructorFile", async () => {
    const { teamSubmissionFileUrl } = await import("./studentService");
    expect(teamSubmissionFileUrl(1, true)).toBe(
      "/api/student/teams/1/submission/file?download=1",
    );
  });
});
