import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectSubmission from "./ProjectSubmission";

vi.mock("../../hooks/useTeamRealtime", () => ({ useTeamRealtime: vi.fn() }));

vi.mock("../../services/studentService", () => ({
  getTeamSubmission: vi.fn(),
  submitTeamProject: vi.fn(),
  fetchTeamSubmissionFile: vi.fn(),
}));

import {
  getTeamSubmission,
  submitTeamProject,
} from "../../services/studentService";

const project = {
  id: 1,
  deadline: "2030-01-01T10:00:00Z",
  submission_file_rules: {
    accepted_extensions: ["pdf", "zip"],
    accepted_mime_types: ["application/pdf", "application/zip"],
    max_size_bytes: 2048,
  },
};

function submissionPayload(name = "project.pdf") {
  return {
    submission: {
      id: 8,
      status: "on_time",
      on_time: true,
      submitted_at: "2026-11-25T10:00:00Z",
      submitter: { name: "Alice Student" },
      file: { original_name: name, size: 25 },
    },
  };
}

function chooseFile(container, name, content = "%PDF-1.4 test") {
  const input = container.querySelector('input[type="file"]');
  fireEvent.change(input, {
    target: { files: [new File([content], name, { type: "application/pdf" })] },
  });
}

describe("ProjectSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamSubmission.mockResolvedValue({ submission: null });
    submitTeamProject.mockResolvedValue(submissionPayload());
  });

  it("shows the deadline, accepted types, size limit, and no-submission state", async () => {
    render(<ProjectSubmission teamId={5} project={project} />);
    await waitFor(() =>
      expect(screen.getByText(/No submission has been uploaded/)).toBeTruthy(),
    );
    expect(screen.getByText(/Jan 1, 2030/)).toBeTruthy();
    expect(screen.getByText(/\.pdf, \.zip/)).toBeTruthy();
    expect(screen.getByText(/Maximum size: 2.0 KB/)).toBeTruthy();
  });

  it("displays selected files, rejects invalid extensions, and blocks after the deadline", async () => {
    const { container } = render(<ProjectSubmission teamId={5} project={project} />);
    await waitFor(() => expect(getTeamSubmission).toHaveBeenCalledWith(5));

    chooseFile(container, "archive.zip");
    expect(screen.getByText(/archive.zip/)).toBeTruthy();
    expect(screen.getByText(/Replace file/)).toBeTruthy();

    chooseFile(container, "malware.exe");
    expect(screen.getByRole("alert").textContent).toContain("Unsupported file type");

    const pastProject = {
      ...project,
      deadline: "2020-01-01T10:00:00Z",
    };
    const past = render(<ProjectSubmission teamId={5} project={pastProject} />);
    await waitFor(() => expect(screen.getByText(/deadline has passed/i)).toBeTruthy());
    past.unmount();
  });

  it("reports real upload progress and refreshes submission details on success", async () => {
    submitTeamProject.mockImplementation(async (_teamId, _file, onProgress) => {
      onProgress(50);
      return submissionPayload("final.pdf");
    });

    const { container } = render(<ProjectSubmission teamId={5} project={project} />);
    await waitFor(() => expect(getTeamSubmission).toHaveBeenCalledWith(5));
    chooseFile(container, "project.pdf");

    fireEvent.click(screen.getByText("Submit project"));
    await waitFor(() =>
      expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50"),
    );
    await waitFor(() =>
      expect(screen.getByText(/submitted successfully/i)).toBeTruthy(),
    );
    expect(screen.getByText("final.pdf")).toBeTruthy();
    expect(screen.getByText("On time")).toBeTruthy();
    expect(screen.getByText("Alice Student")).toBeTruthy();
    expect(submitTeamProject.mock.calls[0][0]).toBe(5);
  });

  it("shows backend validation errors", async () => {
    submitTeamProject.mockRejectedValue(new Error("File exceeds the 2 MB limit"));
    const { container } = render(<ProjectSubmission teamId={5} project={project} />);
    await waitFor(() => expect(getTeamSubmission).toHaveBeenCalledWith(5));
    chooseFile(container, "project.pdf");
    fireEvent.click(screen.getByText("Submit project"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("exceeds the 2 MB limit"),
    );
  });
});
