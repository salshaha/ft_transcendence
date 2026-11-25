import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectFeedbackPanel from "./ProjectFeedbackPanel";

const realtimeHandlers = vi.hoisted(() => ({}));

vi.mock("../../hooks/useTeamRealtime", () => ({
  useRealtimeEvent: vi.fn((event, handler) => {
    realtimeHandlers[event] = handler;
  }),
}));

vi.mock("../../services/studentService", () => ({
  getStudentGrades: vi.fn(),
  getMyPeerFeedback: vi.fn(),
  savePeerFeedback: vi.fn(),
}));

import {
  getMyPeerFeedback,
  getStudentGrades,
  savePeerFeedback,
} from "../../services/studentService";

const endedProject = {
  id: 12,
  title: "Team Platform",
  deadline: "2020-01-01T10:00:00Z",
  peer_feedback_available: true,
  peer_feedback_rules: {
    allow_updates: true,
    min_rating: 1,
    max_rating: 5,
    max_feedback_length: 2000,
  },
};

const teammates = [
  { id: 2, name: "Bob Teammate", is_viewer: false },
  { id: 3, name: "Carol Teammate", is_viewer: false },
  { id: 4, name: "Alice Self", is_viewer: true },
];

function renderPanel(project = endedProject) {
  return render(
    <ProjectFeedbackPanel
      project={project}
      teamId={9}
      teammates={teammates}
      currentUserId={4}
    />,
  );
}

describe("ProjectFeedbackPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete realtimeHandlers.grade_published;
    getStudentGrades.mockResolvedValue({
      grades: [
        {
          id: 1,
          project_id: 12,
          grade: 18.5,
          feedback: "Excellent work and clear documentation.",
          published: true,
          published_at: "2026-11-20T10:00:00Z",
        },
      ],
    });
    getMyPeerFeedback.mockResolvedValue({ peer_feedback: [] });
    savePeerFeedback.mockResolvedValue({ peer_feedback: { id: 7 } });
  });

  it("shows the published grade, feedback, and publication time", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Excellent work and clear documentation.")).toBeTruthy(),
    );
    expect(screen.getByText("18.5")).toBeTruthy();
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.getByText(/Nov 20, 2026/)).toBeTruthy();
  });

  it("shows a clear message when no grade has been published", async () => {
    getStudentGrades.mockResolvedValue({ grades: [] });
    renderPanel();
    await waitFor(() =>
      expect(
        screen.getByText(/has not published a grade for this project/i),
      ).toBeTruthy(),
    );
  });

  it("hides the peer feedback form until the project has ended", async () => {
    renderPanel({
      ...endedProject,
      peer_feedback_available: false,
      deadline: "2030-01-01T10:00:00Z",
    });
    await waitFor(() =>
      expect(
        screen.getByText(/peer feedback becomes available after the project deadline/i),
      ).toBeTruthy(),
    );
    expect(screen.queryByLabelText("Teammate to review")).toBeNull();
  });

  it("submits and updates peer feedback only for eligible teammates", async () => {
    getMyPeerFeedback.mockResolvedValue({
      peer_feedback: [
        {
          id: 7,
          project_id: 12,
          to_student_id: 2,
          recipient: { id: 2, name: "Bob Teammate" },
          rating: 5,
          feedback: "Already submitted review",
          created_at: "2026-11-20T10:00:00Z",
          updated_at: "2026-11-20T10:00:00Z",
        },
      ],
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText("1 submitted")).toBeTruthy());

    const options = screen.getByLabelText("Teammate to review").querySelectorAll("option");
    expect(Array.from(options).map((option) => option.textContent)).toEqual([
      "Select a teammate",
      "Bob Teammate (already submitted)",
      "Carol Teammate",
    ]);
    expect(screen.queryByText("Alice Self")).toBeNull();

    fireEvent.change(screen.getByLabelText("Teammate to review"), {
      target: { value: "2" },
    });
    expect(screen.getByLabelText("Peer rating").value).toBe("5");
    expect(screen.getByLabelText("Peer feedback comment").value).toBe(
      "Already submitted review",
    );
    expect(screen.getByText("Update feedback")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Peer feedback comment"), {
      target: { value: "Improved collaboration" },
    });
    fireEvent.click(screen.getByText("Update feedback"));
    await waitFor(() =>
      expect(savePeerFeedback).toHaveBeenCalledWith({
        projectId: 12,
        toStudentId: 2,
        rating: 5,
        feedback: "Improved collaboration",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/peer feedback was updated/i)).toBeTruthy(),
    );
  });

  it("shows validation errors returned by the backend", async () => {
    savePeerFeedback.mockRejectedValue(
      new Error("Peer feedback is available only after the project ends"),
    );
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("Teammate to review")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Teammate to review"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Peer rating"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Peer feedback comment"), {
      target: { value: "Useful review" },
    });
    fireEvent.click(screen.getByText("Submit feedback"));
    await waitFor(() =>
      expect(
        screen.getByText(/available only after the project ends/i),
      ).toBeTruthy(),
    );
  });

  it("refreshes grades when a grade_published event arrives", async () => {
    renderPanel();
    await waitFor(() => expect(getStudentGrades).toHaveBeenCalledTimes(1));
    getStudentGrades.mockResolvedValue({ grades: [] });
    realtimeHandlers.grade_published({ student_id: 4, project_id: 12 });
    await waitFor(() => expect(getStudentGrades).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByText(/has not published a grade for this project/i),
      ).toBeTruthy(),
    );
  });
});
