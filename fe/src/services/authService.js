const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, payload) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

export function loginUser({ email, password }) {
  return request("/login", { email, password });
}

export function registerUser({ name, email, password, role }) {
  return request("/register", { name, email, password, role });
}
