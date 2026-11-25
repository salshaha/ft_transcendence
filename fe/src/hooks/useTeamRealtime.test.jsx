import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sockets = vi.hoisted(() => []);

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => {
    const handlers = new Map();
    const socket = {
      connected: false,
      handlers,
      on: vi.fn((event, callback) => {
        handlers.set(event, callback);
        return socket;
      }),
      emit: vi.fn((event, payload) => {
        if (event === "join_team" && !socket.connected) {
          socket.connected = true;
          handlers.get("connect")?.();
        }
      }),
      disconnect: vi.fn(() => {
        socket.connected = false;
      }),
    };
    sockets.push(socket);
    return socket;
  }),
}));

import { useRealtimeEvent, useTeamRealtime } from "../hooks/useTeamRealtime";
import { removeById, upsertById } from "../services/realtimeReducers";
import { REALTIME_EVENTS } from "../services/realtimeService";

describe("realtime collaboration", () => {
  beforeEach(() => {
    sockets.length = 0;
  });

  it("declares task, comment, and submission events", () => {
    expect(REALTIME_EVENTS).toEqual(
      expect.arrayContaining([
        "task_created",
        "task_updated",
        "task_deleted",
        "task_status_changed",
        "task_assigned",
        "comment_created",
        "comment_updated",
        "comment_deleted",
        "submission_updated",
        "grade_published",
      ]),
    );
  });

  it("subscribes, receives team events, and cleans up on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useTeamRealtime([7], handler));
    const socket = sockets[sockets.length - 1];

    socket.handlers.get("connect")();
    expect(socket.emit).toHaveBeenCalledWith("join_team", { team_id: 7 });

    const payload = { team_id: 7, task_id: 1, task: { id: 1 } };
    socket.handlers.get("task_updated")(payload);
    expect(handler).toHaveBeenCalledWith("task_updated", payload);

    unmount();
    expect(socket.emit).toHaveBeenCalledWith("leave_team", { team_id: 7 });
  });

  it("rejoins subscribed teams after a reconnection", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useTeamRealtime([9], handler));
    const socket = sockets[sockets.length - 1];

    socket.handlers.get("connect")();
    socket.emit.mockClear();
    socket.handlers.get("disconnect")();
    socket.handlers.get("connect")();

    expect(socket.emit).toHaveBeenCalledWith("join_team", { team_id: 9 });
    unmount();
  });

  it("dispatches grade publication events to user-room subscribers", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useRealtimeEvent("grade_published", handler),
    );
    const socket = sockets[sockets.length - 1];
    const payload = { student_id: 4, project_id: 9, grade: 17 };

    socket.handlers.get("grade_published")(payload);
    expect(handler).toHaveBeenCalledWith(payload);
    unmount();
  });

  it("replaces by id instead of duplicating repeated events", () => {
    const first = upsertById([], { id: 1, title: "Original" });
    const repeated = upsertById(first, { id: 1, title: "Updated" });
    const deleted = removeById(repeated, 1);

    expect(first).toHaveLength(1);
    expect(repeated).toHaveLength(1);
    expect(repeated[0].title).toBe("Updated");
    expect(deleted).toHaveLength(0);
  });
});
