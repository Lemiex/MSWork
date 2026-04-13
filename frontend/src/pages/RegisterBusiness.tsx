import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface RegisterBusinessResponse {
  id: number;
  email: string;
  resetToken: string;
  expiresAt: string;
}

export default function RegisterBusiness() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    business_name: "", owner_name: "", email: "", password: "",
    phone_number: "", postal_address: "", lat: "", lon: "",
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
      const data = await api.post<RegisterBusinessResponse>("/businesses", {
        business_name: form.business_name,
        owner_name:    form.owner_name,
        email:         form.email,
        password:      form.password,
        phone_number:  form.phone_number,
        postal_address: form.postal_address,
        location: { lat: parseFloat(form.lat), lon: parseFloat(form.lon) },
      });
      navigate(`/reset/${data.resetToken}`, { state: { email: form.email, fromRegister: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 500 }}>
        <h1>Register Business</h1>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <div className="form-group">
              <label htmlFor="business_name">Business name</label>
              <input id="business_name" name="business_name" className="form-input" type="text" required
                value={form.business_name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="owner_name">Owner name</label>
              <input id="owner_name" name="owner_name" className="form-input" type="text" required
                value={form.owner_name} onChange={handleChange} />
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
            <label htmlFor="phone_number">Phone number</label>
            <input id="phone_number" name="phone_number" className="form-input" type="tel" required
              value={form.phone_number} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="postal_address">Postal address</label>
            <input id="postal_address" name="postal_address" className="form-input" type="text" required
              value={form.postal_address} onChange={handleChange} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <div className="form-group">
              <label htmlFor="lat">Latitude</label>
              <input id="lat" name="lat" className="form-input" type="number" step="any" required
                placeholder="e.g. 43.6532" value={form.lat} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="lon">Longitude</label>
              <input id="lon" name="lon" className="form-input" type="number" step="any" required
                placeholder="e.g. -79.3832" value={form.lon} onChange={handleChange} />
            </div>
          </div>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create business account"}
          </button>
        </form>

        <div className="auth-links">
          <span>Regular user? <Link to="/register">Register here</Link></span>
          <span>Already have an account? <Link to="/login">Sign in</Link></span>
        </div>
      </div>
    </div>
  );
}
