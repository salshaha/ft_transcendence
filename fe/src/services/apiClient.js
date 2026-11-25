export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

let csrfToken = null;
let csrfRequest = null;

async function fetchCsrfToken(force = false) {
  if (csrfToken && !force) return csrfToken;
  if (csrfRequest && !force) return csrfRequest;

  csrfRequest = fetch(`${API_URL}/api/auth/csrf`, {
    method: "GET",
    credentials: "include",
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.csrf_token) {
        throw new Error("Unable to initialize a secure session. Please retry.");
      }
      csrfToken = data.csrf_token;
      return csrfToken;
    })
    .finally(() => {
      csrfRequest = null;
    });

  return csrfRequest;
}

function rememberCsrfToken(data) {
  if (data && typeof data.csrf_token === "string" && data.csrf_token) {
    csrfToken = data.csrf_token;
  }
}

export async function apiRequest(
  path,
  {
    method = "GET",
    payload,
    body,
    headers: extraHeaders = {},
    errorMessage,
    retryOnCsrfFailure = true,
  } = {},
) {
  const requestMethod = method.toUpperCase();
  const needsCsrf = !SAFE_METHODS.has(requestMethod);
  const headers = { ...extraHeaders };
  let requestBody = body;

  if (payload !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(payload);
  }
  if (needsCsrf) {
    headers["X-CSRF-Token"] = await fetchCsrfToken();
  }

  const send = () =>
    fetch(`${API_URL}${path}`, {
      method: requestMethod,
      credentials: "include",
      headers,
      body: requestBody,
    });

  let response = await send();
  let data = await response.json().catch(() => ({}));
  rememberCsrfToken(data);

  const csrfFailure =
    response.status === 403 &&
    needsCsrf &&
    String(data.message || "").toLowerCase().includes("csrf");

  if (csrfFailure && retryOnCsrfFailure) {
    headers["X-CSRF-Token"] = await fetchCsrfToken(true);
    response = await send();
    data = await response.json().catch(() => ({}));
    rememberCsrfToken(data);
  }

  if (!response.ok) {
    throw new Error(
      data.message || errorMessage || "Something went wrong. Please try again.",
    );
  }
  return data;
}

export async function apiDownload(path) {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Unable to download this report.");
  }
  return response.blob();
}
