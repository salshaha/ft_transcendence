import { useEffect, useState } from "react";
import Modal from "../instructor/Modal";
import Avatar from "./Avatar";
import { deleteStudentAvatar, uploadStudentAvatar } from "../../services/studentService";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function AvatarManager({ user, onChanged }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  function reset() {
    setFile(null);
    setPreview("");
    setError("");
    setMessage("");
    setBusy(false);
  }

  function close() {
    reset();
    setOpen(false);
  }

  function chooseFile(event) {
    const selected = event.target.files?.[0];
    setError("");
    setMessage("");
    if (!selected) return;
    const extension = selected.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(selected.type) || !ALLOWED_EXTENSIONS.includes(extension)) {
      setError("Choose a PNG, JPG, JPEG, GIF, or WEBP image.");
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("Image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function save() {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await uploadStudentAvatar(file);
      setMessage("Profile picture updated.");
      setFile(null);
      if (onChanged) await onChanged();
    } catch (requestError) {
      setError(requestError.message || "Unable to upload image.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await deleteStudentAvatar();
      setMessage("Profile picture removed.");
      setFile(null);
      setPreview("");
      if (onChanged) await onChanged();
    } catch (requestError) {
      setError(requestError.message || "Unable to remove image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar user={user} className="h-16 w-16" rounded="rounded-2xl" />
        <div>
          <h3 className="text-sm font-extrabold text-[#003C43]">Profile picture</h3>
          <p className="text-xs text-[#718b8d]">PNG, JPG, GIF, or WEBP up to 5 MB.</p>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(true);
            }}
            className="mt-2 rounded-xl border border-[#77B0AA]/50 bg-white px-3 py-1.5 text-xs font-bold text-[#135D66] transition hover:bg-[#E3FEF7]"
          >
            Change photo
          </button>
        </div>
      </div>

      {open ? (
        <Modal title="Profile picture" onClose={close}>
          <div className="space-y-4">
            <div className="grid place-items-center rounded-2xl border border-dashed border-[#77B0AA]/50 bg-[#f5faf9] p-5">
              {preview ? (
                <img
                  src={preview}
                  alt="Selected avatar preview"
                  className="h-28 w-28 rounded-2xl border border-[#003C43]/10 object-cover shadow-md"
                />
              ) : (
                <Avatar user={user} className="h-28 w-28" rounded="rounded-2xl" />
              )}
            </div>

            <label className="block text-xs font-bold text-[#003C43]">
              Choose an image
              <input
                type="file"
                accept={ALLOWED_TYPES.join(",")}
                onChange={chooseFile}
                className="mt-1.5 w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#135D66] file:px-3 file:py-1.5 file:text-white"
              />
            </label>

            {file ? (
              <p className="text-xs text-[#718b8d]">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            ) : null}

            {error ? (
              <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-xl bg-[#E3FEF7] px-3 py-2 text-xs font-semibold text-[#135D66]">
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-[#003C43]/8 pt-4">
              {user?.profile_picture ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="mr-auto rounded-xl border border-[#dc2626]/30 px-3 py-2 text-xs font-bold text-[#dc2626] transition hover:bg-[#fee2e2] disabled:opacity-60"
                >
                  Remove photo
                </button>
              ) : null}
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-[#003C43]/15 px-3 py-2 text-xs font-bold text-[#003C43] transition hover:bg-[#E3FEF7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy || !file}
                className="rounded-xl bg-[#135D66] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#135D66]/20 transition hover:bg-[#003C43] disabled:opacity-60"
              >
                {busy ? "Saving..." : "Upload photo"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
