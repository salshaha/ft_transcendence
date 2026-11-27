import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "./AdminDashboard";

vi.mock("../services/adminService", () => ({
  getAdminDashboard: vi.fn(),
  getAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
  getAdminCourses: vi.fn(),
  createAdminCourse: vi.fn(),
  updateAdminCourse: vi.fn(),
  deleteAdminCourse: vi.fn(),
  getAdminAnalytics: vi.fn(),
  downloadAdminAnalytics: vi.fn(),
  downloadAdminAnalyticsPdf: vi.fn(),
  downloadAdminData: vi.fn(),
  importAdminData: vi.fn(),
  getAdminPeerFeedback: vi.fn(),
  getAdminPeerFeedbackDetail: vi.fn(),
  subscribeToAdminAnalytics: vi.fn(() => ({ close: vi.fn() })),
}));

import {
  createAdminCourse,
  getAdminAnalytics,
  getAdminCourses,
  getAdminDashboard,
  getAdminUsers,
} from "../services/adminService";

describe("AdminDashboard course creation validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminDashboard.mockResolvedValue({
      users: 10,
      students: 8,
      instructors: 1,
      admins: 1,
      courses: 1,
      projects: 1,
      teams: 1,
      submissions: 0,
    });
    getAdminAnalytics.mockResolvedValue({
      start_date: "2026-11-01",
      end_date: "2026-11-27",
      totals: { users: 10, teams: 1, tasks: 1, submissions: 0, activity_events: 1 },
      timeline: [],
      recent_activity: [],
    });
    getAdminCourses.mockResolvedValue({
      courses: [
        {
          id: 1,
          name: "Existing Course",
          academic_year: "2025/2026",
          semester: "fall",
          instructor_id: 6,
          microsoft_class_id: "CLS-1",
          student_count: 3,
          projects: [],
        },
      ],
    });
    getAdminUsers.mockResolvedValue({
      users: [
        {
          id: 6,
          first_name: "Instructor1",
          last_name: "Demo",
          email: "instructor1@example.com",
          role: "instructor",
        },
      ],
      total: 1,
      pages: 1,
    });
  });

  it("blocks empty course submission without calling the API and shows a clear message", async () => {
    render(<AdminDashboard user={{ id: 1, first_name: "Admin", email: "admin@example.com" }} onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Courses" }));
    await waitFor(() => expect(getAdminCourses).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "+ Add course" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Course cannot be created");
    expect(alert.textContent).toContain("Name");
    expect(alert.textContent).toContain("Academic year");
    expect(alert.textContent).toContain("Instructor");
    expect(createAdminCourse).not.toHaveBeenCalled();
  });

  it("submits valid course data when all required fields are provided", async () => {
    createAdminCourse.mockResolvedValue({ course: { id: 2, name: "Networks" } });

    render(<AdminDashboard user={{ id: 1, first_name: "Admin", email: "admin@example.com" }} onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Courses" }));
    await waitFor(() => expect(getAdminUsers).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "+ Add course" }));

    fireEvent.change(screen.getByPlaceholderText("e.g. Software Engineering"), {
      target: { value: "Networks" },
    });
    fireEvent.change(screen.getByPlaceholderText("2025/2026"), {
      target: { value: "2026/2027" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Instructor/i }), {
      target: { value: "6" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(createAdminCourse).toHaveBeenCalledWith({
        name: "Networks",
        academic_year: "2026/2027",
        semester: "fall",
        instructor_id: 6,
        microsoft_class_id: null,
      }),
    );
  });
});
