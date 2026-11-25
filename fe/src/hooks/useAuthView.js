import { useCallback, useEffect, useState } from "react";

const AUTH_VIEWS = new Set(["login", "forgot-password", "reset-password"]);

function readLocation() {
  if (typeof window === "undefined") {
    return { view: "login", token: "", email: "" };
  }
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  return {
    view: AUTH_VIEWS.has(requestedView) ? requestedView : "login",
    token: params.get("token") || "",
    email: params.get("email") || "",
  };
}

export function useAuthView() {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    function handlePopState() {
      setLocation(readLocation());
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((view, { token, email, replace = false } = {}) => {
    const next = {
      view: AUTH_VIEWS.has(view) ? view : "login",
      token: token || "",
      email: email || "",
    };
    const params = new URLSearchParams();
    if (next.view !== "login") params.set("view", next.view);
    if (next.token) params.set("token", next.token);
    if (next.email) params.set("email", next.email);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setLocation(next);
  }, []);

  return { ...location, navigate };
}
