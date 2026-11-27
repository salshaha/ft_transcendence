import { useCallback, useEffect, useState } from "react";

const AUTH_VIEWS = new Set(["login", "forgot-password", "reset-password"]);

function readLocation() {
  if (typeof window === "undefined") {
    return { view: "login", token: "", email: "" };
  }
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/+$/, "");
  const pathView =
    pathname === "/forgot-password"
      ? "forgot-password"
      : pathname === "/reset-password"
        ? "reset-password"
        : null;
  const requestedView = pathView || params.get("view");
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
    if (next.token) params.set("token", next.token);
    if (next.email) params.set("email", next.email);
    const pathname = next.view === "login" ? "/" : `/${next.view}`;
    const query = params.toString();
    const url = `${pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setLocation(next);
  }, []);

  return { ...location, navigate };
}
