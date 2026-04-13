import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface Qualification {
  id: number;
  position_type: { id: number; name: string };
  document: string | null;
  note: string | null;
  updatedAt: string;
}

interface CandidateDetail {
  id: number;
  first_name: string;
  last_name: string;
  avatar: string | null;
  resume: string | null;
  biography: string | null;
  qualifications: Qualification[];
}

interface JobSummary {
  id: number;
  status: string;
  position_type: { id: number; name: string; description: string };
  start_time: string;
  end_time: string;
}

interface DetailResponse {
  user: CandidateDetail;
  job: JobSummary;
}

export default function BusinessCandidateDetail() {
  const navigate = useNavigate();
  const { id: jobId, userId } = useParams<{ id: string; userId: string }>();

  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DetailResponse>(`/jobs/${jobId}/candidates/${userId}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load candidate"));
  }, [jobId, userId]);

  if (error) return (
    <div>
      <button className="back-link" onClick={() => navigate(`/business/jobs/${jobId}/candidates`)}>← Back to candidates</button>
      <p className="alert alert-error" role="alert">{error}</p>
    </div>
  );

  if (!detail) return <p style={{ padding: 32, color: "var(--text-muted)" }}>Loading…</p>;

  const { user, job } = detail;
  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();

  return (
    <div>
      <button className="back-link" onClick={() => navigate(`/business/jobs/${jobId}/candidates`)}>← Back to candidates</button>
      <h1 className="page-title">Candidate Detail</h1>

      <div className="card">
        <div className="profile-header">
          {user.avatar
            ? <img src={`${BASE_URL}${user.avatar}`} alt="Avatar" style={{ borderRadius: "var(--radius)", width: 64, height: 64, objectFit: "cover" }} />
            : <div className="avatar-placeholder" style={{ borderRadius: "var(--radius)" }}>{initials}</div>
          }
          <div className="profile-info">
            <p className="profile-name">{user.first_name} {user.last_name}</p>
            <p className="profile-email">{job.position_type.name}</p>
          </div>
        </div>

        {user.biography && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Biography</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{user.biography}</p>
          </div>
        )}

        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Qualifications</h2>
        {user.qualifications.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>No approved qualifications.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {user.qualifications.map((q) => (
              <div key={q.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: q.note ? 8 : 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{q.position_type.name}</span>
                  {q.document && (
                    <a href={`${BASE_URL}${q.document}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                      View document
                    </a>
                  )}
                </div>
                {q.note && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{q.note}</p>}
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Resume</h2>
        {user.resume
          ? <a href={`${BASE_URL}${user.resume}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ display: "inline-block" }}>View resume</a>
          : <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No resume uploaded.</p>
        }
      </div>
    </div>
  );
}
