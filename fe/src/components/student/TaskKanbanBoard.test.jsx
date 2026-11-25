import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TaskKanbanBoard from "./TaskKanbanBoard";

const tasks = [
  {
    id: 1,
    title: "Design screens",
    description: "Prepare the mockups",
    status: "todo",
    assignee: { name: "Alice" },
    due_date: "2026-12-01T10:00:00Z",
    comment_count: 2,
    attachment_count: 1,
    team: { name: "Team A" },
  },
  {
    id: 2,
    title: "Build API",
    status: "in_progress",
    assignee: { name: "Bob" },
    due_date: null,
    team: { name: "Team A" },
  },
];

describe("TaskKanbanBoard", () => {
  it("renders four columns, task details, and empty states", () => {
    render(<TaskKanbanBoard tasks={tasks} onOpen={vi.fn()} onMove={vi.fn()} />);

    for (const label of ["To Do", "In Progress", "Review", "Done"]) {
      expect(screen.getByRole("heading", { name: label })).toBeTruthy();
    }
    expect(screen.getByText("Design screens")).toBeTruthy();
    expect(screen.getByText("Prepare the mockups")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("No tasks in done.")).toBeTruthy();
  });

  it("moves a card by dropping it into another column", () => {
    const onMove = vi.fn();
    render(<TaskKanbanBoard tasks={tasks} onOpen={vi.fn()} onMove={onMove} />);

    const card = screen.getByText("Design screens").closest("article");
    const column = screen.getByLabelText("Review column");
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => "1"),
      effectAllowed: "",
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(column, { dataTransfer });
    fireEvent.drop(column, { dataTransfer });

    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "1");
    expect(onMove).toHaveBeenCalledWith(tasks[0], "review");
  });

  it("moves a card with the status selector and opens it on click", () => {
    const onMove = vi.fn();
    const onOpen = vi.fn();
    render(<TaskKanbanBoard tasks={tasks} onOpen={onOpen} onMove={onMove} />);

    fireEvent.change(
      screen.getByLabelText("Move Design screens to another column"),
      { target: { value: "done" } },
    );
    expect(onMove).toHaveBeenCalledWith(tasks[0], "done");

    fireEvent.click(screen.getByText("Build API"));
    expect(onOpen).toHaveBeenCalledWith(tasks[1]);
  });
});
