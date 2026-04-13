import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface ResetResponse {
  expiresAt: string;
  resetToken: string;
}

export default function Reset() {
  const [email, setEmail]           = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post<ResetResponse>("/auth/resets", { email });
      setResetToken(data.resetToken);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (submitted && resetToken) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
            A password reset link has been sent to <strong>{email}</strong>.
          </p>
          {/* In development the token is returned directly*/}
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            <Link to={`/reset/${resetToken}`} state={{ email }}>
              Click here to set your password
            </Link>
          </p>
          <Link to="/login" style={{ fontSize: 14, color: "var(--text-muted)" }}>← Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset password</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
          Enter your email and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" className="form-input" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <div className="auth-links">
          <span><Link to="/login">← Back to sign in</Link></span>
        </div>
      </div>
    </div>
  );
}
