import { useState } from "react"
import PasswordSecurityCard from "./auth/PasswordSecurityCard"

export default function SettingsPage({
  account,
  accountType = "student",
  onSaveAccount,
  onRequestPasswordReset,
}) {
  const [email, setEmail] = useState(account.email || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const isStudent = accountType === "student"
  const identityLabel = isStudent ? "Student ID" : "Role"
  const identityValue = isStudent
    ? account.student_id || "Not provided"
    : "Instructor"

  async function saveDetails(event) {
    event.preventDefault()
    setMessage("")
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.")
      return
    }
    if (!currentPassword) {
      setError("Enter your current password to save changes.")
      return
    }
    setError("")
    setSaving(true)
    try {
      await onSaveAccount({ email: email.trim(), currentPassword })
      setCurrentPassword("")
      setMessage("Your personal information has been updated.")
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-7">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6D5BD0]">
          Account preferences
        </div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#003C43] sm:text-[30px]">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6d898b]">
          Review your personal information and keep your account secure.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-7">
          <h2 className="text-lg font-extrabold text-[#003C43]">
            Personal information
          </h2>
          <p className="mt-1 text-xs text-[#6d898b]">
            {isStudent
              ? "Your name and student ID are managed by the university."
              : "Your name and role are managed by the platform administrator."}
          </p>
          <form onSubmit={saveDetails} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-[#587376]">
                  Full name
                </label>
                <input
                  value={account.full_name || ""}
                  disabled
                  className="mt-2 w-full cursor-not-allowed rounded-xl bg-[#eef4f3] px-4 py-3 text-sm text-[#8aa1a3] outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#587376]">
                  {identityLabel}
                </label>
                <input
                  value={identityValue}
                  disabled
                  className="mt-2 w-full cursor-not-allowed rounded-xl bg-[#eef4f3] px-4 py-3 text-sm text-[#8aa1a3] outline-none"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="account-email"
                className="text-[10px] font-bold text-[#587376]"
              >
                Email address
              </label>
              <input
                id="account-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setMessage("")
                  setError("")
                }}
                className="theme-control mt-2 w-full rounded-xl border border-[#003C43]/10 bg-white px-4 py-3 text-sm text-[#003C43] outline-none transition focus:border-[#6D5BD0] focus:ring-4 focus:ring-[#6D5BD0]/10"
              />
            </div>
            <div>
              <label
                htmlFor="account-current-password"
                className="text-[10px] font-bold text-[#587376]"
              >
                Current password
              </label>
              <input
                id="account-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value)
                  setMessage("")
                  setError("")
                }}
                autoComplete="current-password"
                placeholder="Required to change account details"
                className="theme-control mt-2 w-full rounded-xl border border-[#003C43]/10 bg-white px-4 py-3 text-sm text-[#003C43] outline-none transition focus:border-[#6D5BD0] focus:ring-4 focus:ring-[#6D5BD0]/10"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-[#fff0f0] px-4 py-3 text-[11px] font-semibold text-[#a94646]" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl bg-[#E3FEF7] px-4 py-3 text-[11px] font-semibold text-[#135D66]" role="status">
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#6D5BD0] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#5c49c5] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving changes..." : "Save changes"}
            </button>
          </form>
        </section>

        <PasswordSecurityCard
          email={email}
          onRequestPasswordReset={onRequestPasswordReset}
        />
      </div>
    </div>
  )
}
