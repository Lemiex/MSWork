import { Link, useLocation } from "react-router-dom";

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: 96,
          fontWeight: 900,
          letterSpacing: -4,
          lineHeight: 1,
          color: "var(--accent)",
        }}
      >
        404
      </p>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          textTransform: "uppercase",
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        Page not found
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, maxWidth: 380 }}>
        <code
          style={{
            background: "#111",
            color: "#fff",
            padding: "2px 6px",
            borderRadius: "var(--radius)",
            fontSize: 13,
          }}
        >
          {pathname}
        </code>{" "}
        doesn't exist.
      </p>
      <Link className="btn btn-primary" to="/" style={{ textDecoration: "none" }}>
        Go home
      </Link>
    </div>
  );
}
