export default function PasswordSecurityCard({ email, onRequestPasswordReset }) {
  return (
    <section className="theme-surface h-fit rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-7">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f5f3ff] text-[#6D5BD0]">
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      </div>
      <h2 className="mt-5 text-lg font-extrabold text-[#003C43]">
        Password &amp; security
      </h2>
      <p className="mt-2 text-xs leading-5 text-[#6d898b]">
        Request a one-time token to choose a new password for your account.
        Tokens expire after one hour and can be used once.
      </p>
      {email && (
        <p className="mt-3 break-all text-[11px] font-semibold text-[#587376]">
          Signed in as {email}
        </p>
      )}
      <button
        type="button"
        onClick={() => onRequestPasswordReset(email)}
        className="mt-6 w-full rounded-xl border border-[#6D5BD0]/25 px-4 py-3 text-xs font-bold text-[#6D5BD0] transition hover:bg-[#f5f3ff] active:scale-[0.98]"
      >
        Reset password
      </button>
    </section>
  )
}
