import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

interface QualDetail {
  id: number;
  status: string;
  note: string;
  document: string | null;
  updatedAt: string;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    postal_address: string;
    avatar: string | null;
    suspended: boolean;
    activated: boolean;
  };
  position_type: { id: number; name: string; description: string };
}

const ADMIN_TRANSITIONS: Record<string, ("approved" | "rejected")[]> = {
  created:   ["approved", "rejected"],
  submitted: ["approved", "rejected"],
  approved:  ["rejected"],
  rejected:  ["approved"],
  revised:   ["approved", "rejected"],
};

export default function AdminQualificationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [qual, setQual]   = useState<QualDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<QualDetail>(`/qualifications/${id}`)
      .then(setQual)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load qualification"));
  }, [id]);

  async function decide(status: "approved" | "rejected") {
    if (!qual) return;
    setActing(true);
    setError(null);
    try {
      const updated = await api.patch<QualDetail>(`/qualifications/${qual.id}`, { status });
      setQual((prev) => prev ? { ...prev, status: updated.status, updatedAt: updated.updatedAt } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setActing(false);
    }
  }

  if (error && !qual) {
    return (
      <div>
        <Link to="/admin/qualifications" className="back-link">← Qualification Reviews</Link>
        <p className="alert alert-error" role="alert">{error}</p>
      </div>
    );
  }

  if (!qual) return <p style={{ padding: 32, color: "var(--text-muted)" }}>Loading…</p>;

  const nextStatuses = ADMIN_TRANSITIONS[qual.status] ?? [];
  const initials = `${qual.user.first_name[0]}${qual.user.last_name[0]}`.toUpperCase();

  return (
    <div>
      <button className="back-link" onClick={() => navigate(-1)}>← Qualification Reviews</button>

      <h1 className="page-title">Qualification Review</h1>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {/* Status + actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p className="card-title" style={{ marginBottom: 4 }}>{qual.position_type.name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`badge badge-${qual.status}`}>{qual.status}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Updated {new Date(qual.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {nextStatuses.length > 0 ? (
              nextStatuses.map((s) => (
                <button
                  key={s}
                  className={`btn btn-sm ${s === "approved" ? "btn-primary" : "btn-ghost"}`}
                  disabled={acting}
                  onClick={() => decide(s)}
                >
                  {acting ? "…" : s === "approved" ? "Approve" : "Reject"}
                </button>
              ))
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No admin actions available in this status
              </span>
            )}
          </div>
        </div>
        {qual.position_type.description && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
            {qual.position_type.description}
          </p>
        )}
      </div>

      {/* Applicant */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="card-title">Applicant</p>
        <div className="profile-header" style={{ marginBottom: 0 }}>
          {qual.user.avatar
            ? <img className="avatar-img" src={`${BASE_URL}${qual.user.avatar}`} alt="Avatar"
                style={{ borderRadius: "var(--radius)", width: 56, height: 56, objectFit: "cover" }} />
            : <div className="avatar-placeholder" style={{ borderRadius: "var(--radius)", width: 56, height: 56, fontSize: 18 }}>
                {initials}
              </div>
          }
          <div className="profile-info">
            <p className="profile-name" style={{ fontSize: 16 }}>
              {qual.user.first_name} {qual.user.last_name}
            </p>
            <p className="profile-email">{qual.user.email}</p>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {!qual.user.activated && <span className="badge badge-created">Not activated</span>}
              {qual.user.suspended && <span className="badge badge-rejected">Suspended</span>}
            </div>
          </div>
        </div>
        <div className="detail-grid" style={{ marginTop: 16 }}>
          {qual.user.phone_number && (
            <div className="detail-field"><label>Phone</label><p>{qual.user.phone_number}</p></div>
          )}
          {qual.user.postal_address && (
            <div className="detail-field"><label>Address</label><p>{qual.user.postal_address}</p></div>
          )}
        </div>
      </div>

      {/* Note & document */}
      <div className="card">
        <p className="card-title">Submission</p>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Note</p>
          {qual.note
            ? <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>{qual.note}</p>
            : <p style={{ fontSize: 14, color: "var(--text-muted)", fontStyle: "italic" }}>No note provided</p>
          }
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Document</p>
          {qual.document
            ? <a className="btn btn-ghost btn-sm" href={`${BASE_URL}${qual.document}`} target="_blank" rel="noreferrer">
                View document
              </a>
            : <p style={{ fontSize: 14, color: "var(--text-muted)", fontStyle: "italic" }}>No document uploaded</p>
          }
        </div>
      </div>
    </div>
  );
}
