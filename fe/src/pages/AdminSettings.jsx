import PasswordSecurityCard from "../components/auth/PasswordSecurityCard";

export default function AdminSettings({ user, onLogout, onRequestPasswordReset }) {
  return (
    <div className="theme-page min-h-screen bg-[#f5faf9] p-4 sm:p-8">
      <main className="mx-auto max-w-4xl">
        <div className="mb-7">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6D5BD0]">
            Account preferences
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#003C43] sm:text-[30px]">
            Admin settings
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6d898b]">
            Review your account and keep it secure.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <section className="theme-surface rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,60,67,0.06)] sm:p-7">
            <h2 className="text-lg font-extrabold text-[#003C43]">Account</h2>
            <p className="mt-3 break-all text-xs font-semibold text-[#365c60]">
              {user.first_name} {user.last_name}
            </p>
            <p className="mt-2 break-all text-xs text-[#6d898b]">{user.email}</p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-6 rounded-xl border border-[#003C43]/15 px-4 py-3 text-xs font-bold text-[#135D66] transition hover:bg-[#E3FEF7]"
            >
              Sign out
            </button>
          </section>
          <PasswordSecurityCard
            email={user.email}
            onRequestPasswordReset={onRequestPasswordReset}
          />
        </div>
      </main>
    </div>
  )
}
