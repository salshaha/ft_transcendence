import { API_URL, fetchCsrfToken } from "./apiClient";

function parseResponse(xhr) {
  let data = {};
  try {
    data = JSON.parse(xhr.responseText || "{}");
  } catch (_error) {
    data = {};
  }
  return data;
}

function sendUpload(
  path,
  file,
  field,
  token,
  onProgress,
  signal,
  resolve,
  reject,
  attempt = 0,
) {
  const form = new FormData();
  form.append(field, file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_URL}${path}`);
  xhr.withCredentials = true;
  xhr.setRequestHeader("X-CSRF-Token", token);

  xhr.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable) {
      onProgress(Math.round((event.loaded / event.total) * 100));
    }
  });

  xhr.addEventListener("load", () => {
    if (signal?.aborted) return;
    const data = parseResponse(xhr);
    if (xhr.status >= 200 && xhr.status < 300) {
      resolve(data);
      return;
    }
    const message = data.message || "Unable to upload the file.";
    const csrfFailure =
      xhr.status === 403 && String(message).toLowerCase().includes("csrf");
    if (csrfFailure && attempt < 1) {
      fetchCsrfToken(true)
        .then((refreshed) =>
          sendUpload(
            path,
            file,
            field,
            refreshed,
            onProgress,
            signal,
            resolve,
            reject,
            attempt + 1,
          ),
        )
        .catch(reject);
      return;
    }
    const error = new Error(message);
    error.status = xhr.status;
    error.response = data;
    reject(error);
  });

  xhr.addEventListener("error", () =>
    reject(new Error("The upload failed. Check your connection and retry.")),
  );
  xhr.addEventListener("abort", () => {
    const error = new Error("Upload cancelled");
    error.name = "AbortError";
    reject(error);
  });

  if (signal) {
    if (signal.aborted) {
      xhr.abort();
      return;
    }
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
  }

  xhr.send(form);
}

export function uploadWithProgress(
  path,
  file,
  { field = "file", onProgress = () => {}, signal } = {},
) {
  return new Promise((resolve, reject) => {
    fetchCsrfToken()
      .then((token) =>
        sendUpload(
          path,
          file,
          field,
          token,
          onProgress,
          signal,
          resolve,
          reject,
        ),
      )
      .catch(reject);
  });
}
