import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GradeManagement from "./GradeManagement";

vi.mock("../../services/instructorService", () => ({
  getInstructorCourseStudents: vi.fn(),
  getInstructorGradeAudit: vi.fn(),
  getInstructorGrades: vi.fn(),
  publishAllInstructorGrades: vi.fn(),
  saveInstructorGrade: vi.fn(),
  setInstructorGradePublished: vi.fn(),
}));

import { getInstructorCourseStudents, getInstructorGrades } from "../../services/instructorService";

const courses = [
  {
    id: 6,
    name: "Course 6",
    projects: [{ id: 60, title: "Project 60", max_grade: 100 }],
  },
];

describe("GradeManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInstructorCourseStudents.mockResolvedValue({ students: [] });
    getInstructorGrades.mockResolvedValue({ grades: [] });
  });

  it("filters grades with backend snake_case keys", async () => {
    render(<GradeManagement courses={courses} projects={courses[0].projects} initialCourseId="6" />);
    await waitFor(() => expect(getInstructorGrades).toHaveBeenCalled());
    const filters = getInstructorGrades.mock.calls.at(-1)[0];
    expect(filters).toMatchObject({ course_id: 6 });
    expect(filters).not.toHaveProperty("courseId");
    expect(filters).not.toHaveProperty("projectId");
    expect(filters).not.toHaveProperty("studentId");
    await waitFor(() => expect(screen.getByText(/No grades recorded for these filters yet/)).toBeTruthy());
  });
});
