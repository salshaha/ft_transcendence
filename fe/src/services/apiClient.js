const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export async function apiRequest(
  path,
  { method = "GET", payload, errorMessage } = {},
) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.message || errorMessage || "Something went wrong. Please try again.",
    );
  }
  return data;
}
