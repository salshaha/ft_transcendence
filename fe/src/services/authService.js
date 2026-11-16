const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

async function request(path, payload) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

export function loginUser({ email, password }) {
  return request("/api/auth/login", { email, password });
}

export function registerUser({ first_name, last_name, student_id, email, password, role }) {
  return request("/api/auth/register", {
    first_name,
    last_name,
    student_id,
    email,
    password,
    role,
  });
}
