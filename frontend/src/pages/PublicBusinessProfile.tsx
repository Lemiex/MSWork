import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

interface PublicBusiness {
  id: number;
  business_name: string;
  email: string;
  phone_number: string;
  postal_address: string;
  location: { lat: number; lon: number };
  avatar: string | null;
  biography: string | null;
}

export default function PublicBusinessProfile() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<PublicBusiness>(`/businesses/${id}`)
      .then(setBusiness)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load business"));
  }, [id]);

  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link className="navbar-brand" to="/" style={{ textDecoration: "none" }}>MS WORK</Link>
          <div className="navbar-links">
            <Link className="navbar-link" to="/businesses">Browse Businesses</Link>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <Link className="btn btn-ghost btn-sm" to="/login" style={{ textDecoration: "none" }}>Sign in</Link>
            <Link className="btn btn-primary btn-sm" to="/register" style={{ textDecoration: "none" }}>Register</Link>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Link to="/businesses" className="back-link">← All Businesses</Link>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {!business && !error && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}

        {business && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="profile-header">
                {business.avatar
                  ? <img
                      className="avatar-img"
                      src={`${BASE_URL}${business.avatar}`}
                      alt={`${business.business_name} avatar`}
                      style={{ borderRadius: "var(--radius)", width: 72, height: 72, objectFit: "cover" }}
                    />
                  : <div
                      className="avatar-placeholder"
                      style={{ borderRadius: "var(--radius)" }}
                    >
                      {business.business_name.slice(0, 2).toUpperCase()}
                    </div>
                }
                <div className="profile-info">
                  <p className="profile-name">{business.business_name}</p>
                  <p className="profile-email">{business.email}</p>
                </div>
              </div>

              {business.biography && (
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
                  {business.biography}
                </p>
              )}

              <div className="detail-grid">
                <div className="detail-field">
                  <label>Address</label>
                  <p>{business.postal_address}</p>
                </div>
                <div className="detail-field">
                  <label>Phone</label>
                  <p>{business.phone_number}</p>
                </div>
                <div className="detail-field">
                  <label>Location</label>
                  <p>{business.location.lat}, {business.location.lon}</p>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Want to work here?{" "}
              <Link to="/register/user">Create an account</Link> or{" "}
              <Link to="/login">sign in</Link> to browse and apply for jobs.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
