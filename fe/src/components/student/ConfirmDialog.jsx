import { useState } from "react";
import Modal from "../instructor/Modal";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onClose,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (requestError) {
      setError(requestError.message || "Unable to complete this action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-[#718b8d]">{message}</p>
        {error ? (
          <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]">
            {error}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-[#003C43]/8 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#003C43]/15 px-4 py-2 text-sm font-bold text-[#003C43] transition hover:bg-[#E3FEF7]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${
              destructive
                ? "bg-[#dc2626] hover:bg-[#991b1b]"
                : "bg-[#135D66] hover:bg-[#003C43]"
            }`}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
