import { useEffect, useRef, useState } from "react";
import {
  subscribeConnection,
  subscribeEvent,
  subscribeTeam,
} from "../services/realtimeService";

function asIds(teamIds) {
  if (teamIds === null || teamIds === undefined) return [];
  const values = Array.isArray(teamIds) ? teamIds : [teamIds];
  return Array.from(new Set(values.map(Number).filter(Boolean))).sort(
    (left, right) => left - right,
  );
}

export function useTeamRealtime(teamIds, onEvent) {
  const callbackRef = useRef(onEvent);
  const key = asIds(teamIds).join(",");

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const ids = key ? key.split(",").map(Number) : [];
    const unsubscribe = ids.map((id) =>
      subscribeTeam(id, (event, payload) => callbackRef.current?.(event, payload)),
    );
    return () => unsubscribe.forEach((stop) => stop());
  }, [key]);
}

export function useRealtimeEvent(event, onEvent) {
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!event) return undefined;
    return subscribeEvent(event, (_event, payload) => callbackRef.current?.(payload));
  }, [event]);
}

export function useRealtimeConnection() {
  const [status, setStatus] = useState({ connected: false, error: "" });

  useEffect(() => subscribeConnection(setStatus), []);

  return status;
}
