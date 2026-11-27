import { io } from "socket.io-client";
import { API_URL } from "./apiClient";

const REALTIME_URL = (
  import.meta.env.VITE_REALTIME_URL || API_URL
).replace(/\/$/, "");

const EVENTS = [
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
  "message_created",
  "team_access_revoked",
];

const teamSubscriptions = new Map();
const eventSubscriptions = new Map();
const connectionHandlers = new Set();
let socket = null;
let connected = false;
let lastError = "";

function notifyConnection() {
  connectionHandlers.forEach((handler) => {
    try {
      handler({ connected, error: lastError });
    } catch (error) {
      console.error("Realtime connection handler failed", error);
    }
  });
}

function dispatchEvent(event, payload) {
  const teamId = Number(payload?.team_id);
  if (teamId) {
    teamSubscriptions.get(teamId)?.forEach((handler) => {
      try {
        handler(event, payload);
      } catch (error) {
        console.error("Realtime event handler failed", error);
      }
    });
  }
  eventSubscriptions.get(event)?.forEach((handler) => {
    try {
      handler(event, payload);
    } catch (error) {
      console.error("Realtime event handler failed", error);
    }
  });
}

function ensureSocket() {
  if (socket) return socket;

  socket = io(REALTIME_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    connected = true;
    lastError = "";
    teamSubscriptions.forEach((_handlers, teamId) => {
      socket.emit("join_team", { team_id: teamId });
    });
    notifyConnection();
  });

  socket.on("disconnect", () => {
    connected = false;
    notifyConnection();
  });

  socket.on("connect_error", (error) => {
    connected = false;
    lastError = error?.message || "Realtime connection failed";
    notifyConnection();
  });

  socket.on("realtime_error", (payload) => {
    lastError = payload?.message || "Realtime subscription failed";
    notifyConnection();
  });

  EVENTS.forEach((event) => {
    socket.on(event, (payload) => dispatchEvent(event, payload));
  });

  return socket;
}

function maybeDisconnect() {
  if (teamSubscriptions.size === 0 && eventSubscriptions.size === 0 && socket) {
    socket.disconnect();
    socket = null;
    connected = false;
    notifyConnection();
  }
}

export function subscribeTeam(teamId, handler) {
  const id = Number(teamId);
  if (!id || typeof handler !== "function") return () => {};

  if (!teamSubscriptions.has(id)) teamSubscriptions.set(id, new Set());
  teamSubscriptions.get(id).add(handler);

  const client = ensureSocket();
  if (client.connected) client.emit("join_team", { team_id: id });

  return () => {
    const handlers = teamSubscriptions.get(id);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      teamSubscriptions.delete(id);
      if (socket?.connected) socket.emit("leave_team", { team_id: id });
    }
    maybeDisconnect();
  };
}

export function subscribeEvent(event, handler) {
  if (!event || typeof handler !== "function") return () => {};
  if (!eventSubscriptions.has(event)) eventSubscriptions.set(event, new Set());
  eventSubscriptions.get(event).add(handler);

  ensureSocket();

  return () => {
    const handlers = eventSubscriptions.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) eventSubscriptions.delete(event);
    maybeDisconnect();
  };
}

export function subscribeConnection(handler) {
  connectionHandlers.add(handler);
  try {
    handler({ connected, error: lastError });
  } catch (error) {
    console.error("Realtime connection handler failed", error);
  }
  return () => connectionHandlers.delete(handler);
}

export const REALTIME_EVENTS = EVENTS;
