import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamChatPanel from "./TeamChatPanel";

vi.mock("../../hooks/useTeamRealtime", () => ({
  useTeamRealtime: vi.fn(),
  useRealtimeEvent: vi.fn(),
}));

vi.mock("../../services/studentService", () => ({
  avatarUrl: vi.fn(() => ""),
  getTeamChats: vi.fn(),
  getTeamMessages: vi.fn(),
  sendTeamMessage: vi.fn(),
}));

import {
  getTeamChats,
  getTeamMessages,
  sendTeamMessage,
} from "../../services/studentService";

describe("TeamChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamChats.mockResolvedValue({
      chats: [
        {
          team_id: 8,
          name: "Team Alpha",
          course: { name: "Web Development" },
          member_count: 3,
          unread_count: 0,
          last_message: { content: "Hello team" },
        },
      ],
    });
    getTeamMessages.mockResolvedValue({
      messages: [
        {
          id: 1,
          team_id: 8,
          sender_id: 2,
          sender: { name: "Bob Teammate" },
          content: "Hello team",
          created_at: "2026-11-25T10:00:00Z",
        },
      ],
    });
    sendTeamMessage.mockResolvedValue({
      message: {
        id: 2,
        team_id: 8,
        sender_id: 1,
        sender: { name: "You" },
        content: "Ready to test",
        created_at: "2026-11-25T10:01:00Z",
      },
    });
  });

  it("renders a team conversation and sends a message", async () => {
    render(<TeamChatPanel currentUserId={1} />);

    await waitFor(() => expect(screen.getByLabelText("Message")).toBeTruthy());
    expect(screen.getAllByText("Team Alpha")[0]).toBeTruthy();
    expect(screen.getAllByText("Hello team")[0]).toBeTruthy();
    expect(screen.getByText("Web Development · 3 members")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Ready to test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(sendTeamMessage).toHaveBeenCalledWith(8, "Ready to test"),
    );
    expect(await screen.findByText("Ready to test")).toBeTruthy();
  });
});
