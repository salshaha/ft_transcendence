const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, payload) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

export function loginUser({ email, password, role }) {
  return request("/api/login", { email, password, role });
}

export function registerUser({ name, email, password, role }) {
  const [first_name, ...lastParts] = name.trim().split(/\s+/);
  return request("/api/signup", {
    first_name,
    last_name: lastParts.join(" ") || first_name,
    email,
    password,
    role,
  });
}
