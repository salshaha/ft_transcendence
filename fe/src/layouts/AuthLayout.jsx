import "./auth.css";

function Sparkle({ className }) {
  return <span className={`sparkle ${className || ""}`} aria-hidden="true">✦</span>;
}

export default function AuthLayout({ children }) {
  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="Pingora introduction">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <Sparkle className="sparkle-one" />
        <Sparkle className="sparkle-two" />
        <div className="brand-mark">P</div>
        <p className="eyebrow">WELCOME TO PINGORA</p>
        <h1>Make every<br /><span>moment</span> count.</h1>
        <p className="hero-copy">One place to learn, connect, and grow together. Your next great chapter starts here.</p>
        <div className="hero-footer"><span className="status-dot" /> Built for curious minds</div>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
