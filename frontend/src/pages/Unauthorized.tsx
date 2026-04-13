import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Unauthorized() {
  const { user } = useAuth();

  const homeLink = !user
    ? "/"
    : user.role === "admin"
    ? "/admin"
    : user.role === "business"
    ? "/business/profile"
    : "/jobs";

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
          color: "var(--danger)",
        }}
      >
        403
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
        Access denied
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, maxWidth: 380 }}>
        You don't have permission to view this page.
      </p>
      <Link
        className="btn btn-primary"
        to={homeLink}
        style={{ textDecoration: "none" }}
      >
        Go home
      </Link>
    </div>
  );
}
