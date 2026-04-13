import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface RegisterResponse {
  id: number;
  email: string;
  resetToken: string;
  expiresAt: string;
}

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", password: "",
    phone_number: "", postal_address: "", birthday: "",
  });
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string> = {
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, password: form.password,
      };
      if (form.phone_number)   body.phone_number   = form.phone_number;
      if (form.postal_address) body.postal_address = form.postal_address;
      if (form.birthday)       body.birthday       = form.birthday;

      const data = await api.post<RegisterResponse>("/users", body);
      navigate(`/reset/${data.resetToken}`, { state: { email: form.email, fromRegister: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <div className="form-group">
              <label htmlFor="first_name">First name</label>
              <input id="first_name" name="first_name" className="form-input" type="text" required
                value={form.first_name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Last name</label>
              <input id="last_name" name="last_name" className="form-input" type="text" required
                value={form.last_name} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" className="form-input" type="email" required autoComplete="email"
              value={form.email} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" className="form-input" type="password" required autoComplete="new-password"
              value={form.password} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="phone_number">Phone number <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input id="phone_number" name="phone_number" className="form-input" type="tel"
              value={form.phone_number} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="postal_address">Postal address <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input id="postal_address" name="postal_address" className="form-input" type="text"
              value={form.postal_address} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="birthday">Birthday <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input id="birthday" name="birthday" className="form-input" type="date"
              value={form.birthday} onChange={handleChange} />
          </div>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-links">
          <span>Already have an account? <Link to="/login">Sign in</Link></span>
        </div>
      </div>
    </div>
  );
}
