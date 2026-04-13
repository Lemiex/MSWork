import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <nav className="navbar">
        <div className="navbar-inner">
          <span className="navbar-brand">MS WORK</span>
          <div className="navbar-links">
            <Link className="navbar-link" to="/businesses">
              Browse Businesses
            </Link>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <Link
              className="btn btn-ghost btn-sm"
              to="/login"
              style={{ textDecoration: "none" }}
            >
              Sign in
            </Link>
            <Link
              className="btn btn-primary btn-sm"
              to="/register"
              style={{ textDecoration: "none" }}
            >
              Register
            </Link>
          </div>
        </div>
      </nav>

      <main
        style={{
          flex: 1,
          maxWidth: 860,
          margin: "0 auto",
          width: "100%",
          padding: "72px 24px",
        }}
      >
        <h1
          style={{
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: -1,
            marginBottom: 16,
            textTransform: "uppercase",
            lineHeight: 1.1,
          }}
        >
          Find flexible work,
          <br />
          hire great talent.
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "var(--text-muted)",
            maxWidth: 520,
            marginBottom: 36,
            lineHeight: 1.6,
          }}
        >
          MS Work (by Michelle and Sarah) connects businesses with workers for
          short-term and contract positions. Create an account or browse our
          businesses to get started.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 64,
          }}
        >
          <Link
            className="btn btn-primary"
            to="/register/user"
            style={{ textDecoration: "none" }}
          >
            Join as a worker
          </Link>
          <Link
            className="btn btn-ghost"
            to="/register/business"
            style={{ textDecoration: "none" }}
          >
            Register a business
          </Link>
          <Link
            className="btn btn-secondary"
            to="/businesses"
            style={{ textDecoration: "none" }}
          >
            Browse businesses
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              title: "For Workers",
              body: "Browse job listings matched to your qualifications and apply in one click.",
            },
            {
              title: "For Businesses",
              body: "Post positions, review applicants, and negotiate terms directly on the platform.",
            },
            {
              title: "Transparent Process",
              body: "Track every application, invitation, and negotiation from one dashboard.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="card">
              <p className="card-title">{title}</p>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-muted)",
                  lineHeight: 1.55,
                }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer
        style={{
          borderTop: "var(--border)",
          padding: "20px 24px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        <Link to="/login" style={{ marginRight: 16 }}>
          Sign in
        </Link>
        <Link to="/register">Create account</Link>
      </footer>
    </div>
  );
}
