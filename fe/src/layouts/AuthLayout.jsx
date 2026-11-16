import "./auth.css";

export default function AuthLayout({ children }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">{children}</section>
    </main>
  );
}
