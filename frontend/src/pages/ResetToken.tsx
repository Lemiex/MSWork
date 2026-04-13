import { useState, type FormEvent } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface LocationState {
  email?: string;
  fromRegister?: boolean;
}

export default function ResetToken() {
  const { token } = useParams<{ token: string }>();
  const location  = useLocation();
  const navigate  = useNavigate();
  const state     = (location.state ?? {}) as LocationState;

  const [email, setEmail]       = useState(state.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const isActivation = !!state.fromRegister;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isActivation && password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const body = isActivation ? { email } : { email, password };
      await api.post(`/auth/resets/${token}`, body);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{isActivation ? "Activate your account" : "Set new password"}</h1>

        {isActivation && (
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
            Confirm your email to activate your account.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" className="form-input" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {!isActivation && (
            <>
              <div className="form-group">
                <label htmlFor="password">New password</label>
                <input id="password" className="form-input" type="password" required autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="confirm">Confirm password</label>
                <input id="confirm" className="form-input" type="password" required autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </>
          )}

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading
              ? isActivation ? "Activating…" : "Saving…"
              : isActivation ? "Activate account" : "Set password"}
          </button>
        </form>

        <div className="auth-links">
          <span><Link to="/login">← Back to sign in</Link></span>
        </div>
      </div>
    </div>
  );
}
