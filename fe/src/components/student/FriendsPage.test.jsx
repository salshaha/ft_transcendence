import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FriendsPage from "./FriendsPage";

vi.mock("../../hooks/useTeamRealtime", () => ({
  useRealtimeEvent: vi.fn(),
}));

vi.mock("../../services/studentService", () => ({
  acceptFriendRequest: vi.fn(),
  avatarUrl: vi.fn(() => ""),
  getFriendOverview: vi.fn(),
  rejectFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  searchFriends: vi.fn(),
  sendFriendRequest: vi.fn(),
}));

import {
  acceptFriendRequest,
  getFriendOverview,
  searchFriends,
  sendFriendRequest,
} from "../../services/studentService";

describe("FriendsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFriendOverview.mockResolvedValue({
      friends: [
        { id: 2, full_name: "Alice Friend", major: "IT", is_online: true },
      ],
      incoming: [
        { id: 4, user: { id: 4, full_name: "Bob Incoming" } },
      ],
      outgoing: [
        { id: 5, user: { id: 5, full_name: "Dana Outgoing" } },
      ],
    });
    searchFriends.mockResolvedValue({
      students: [
        {
          id: 2,
          full_name: "Alice Friend",
          major: "IT",
          relationship: "friend",
        },
        {
          id: 3,
          full_name: "Casey Classmate",
          major: "CS",
          relationship: "none",
        },
      ],
    });
    acceptFriendRequest.mockResolvedValue({ status: "accepted" });
    sendFriendRequest.mockResolvedValue({ status: "pending" });
  });

  it("shows friends and requests, then sends a friend request", async () => {
    render(<FriendsPage presence={{ users: {} }} />);

    await waitFor(() => expect(screen.getAllByText("Alice Friend")[0]).toBeTruthy());
    expect(screen.getByText("Bob Incoming")).toBeTruthy();
    expect(screen.getByText("Dana Outgoing")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add Friend" }));

    await waitFor(() =>
      expect(sendFriendRequest).toHaveBeenCalledWith(3),
    );
  });

  it("accepts an incoming request", async () => {
    render(<FriendsPage presence={{ users: {} }} />);

    const acceptButtons = await screen.findAllByRole("button", {
      name: "Accept",
    });
    fireEvent.click(acceptButtons[0]);

    await waitFor(() => expect(acceptFriendRequest).toHaveBeenCalledWith(4));
  });
});
