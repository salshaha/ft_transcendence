import { useEffect, useRef, useState } from "react";
import { pingPresence, presenceStreamUrl } from "../services/studentService";

const PING_INTERVAL_MS = 30000;

export function usePresence() {
  const [users, setUsers] = useState({});
  const [connected, setConnected] = useState(false);
  const connectionIdRef = useRef(null);

  useEffect(() => {
    const source = new EventSource(presenceStreamUrl(), { withCredentials: true });

    const onPresence = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.connection_id) connectionIdRef.current = payload.connection_id;
        if (payload.users) {
          setUsers((current) => ({ ...current, ...payload.users }));
        }
        setConnected(true);
      } catch (error) {
        console.error("Invalid presence event", error);
      }
    };

    source.addEventListener("presence", onPresence);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    const ping = () => {
      if (!connectionIdRef.current || document.visibilityState !== "visible") return;
      pingPresence(connectionIdRef.current)
        .then((data) => {
          if (data?.connection_id) connectionIdRef.current = data.connection_id;
          setConnected(true);
        })
        .catch(() => setConnected(false));
    };

    const timer = setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
      source.removeEventListener("presence", onPresence);
      source.close();
    };
  }, []);

  const statusFor = (userId) =>
    users[String(userId)] || { online: false, last_seen: null };

  return {
    users,
    connected,
    statusFor,
    isOnline: (userId) => Boolean(statusFor(userId).online),
    lastSeen: (userId) => statusFor(userId).last_seen,
  };
}
