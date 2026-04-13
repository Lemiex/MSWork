import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

interface Job {
  id: number;
  status: string;
  position_type: { id: number; name: string };
  business: { id: number; business_name: string };
  worker: { id: number; first_name: string; last_name: string } | null;
  note: string | null;
  salary_min: number;
  salary_max: number;
  start_time: string;
  end_time: string;
  candidate_interested: boolean;
  distance?: number;
  eta?: number;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interested, setInterested] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<Job>(`/jobs/${id}`)
      .then((job) => {
        setJob(job);
        setInterested(job.candidate_interested);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load job")
      );
  }, [id]);

  async function toggleInterest() {
    if (!job) return;
    const next = interested !== true;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/jobs/${job.id}/interested`, { interested: next });
      setInterested(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update interest"
      );
    } finally {
      setSaving(false);
    }
  }

  if (error && !job)
    return (
      <div>
        <button className="back-link" onClick={() => navigate("/jobs")}>
          ← Back to jobs
        </button>
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      </div>
    );
  if (!job)
    return <p style={{ padding: 32, color: "var(--text-muted)" }}>Loading…</p>;

  const isOpen = job.status === "open";
  const badgeClass = `badge badge-${job.status}`;

  return (
    <div>
      <button className="back-link" onClick={() => navigate("/jobs")}>
        ← Back to jobs
      </button>

      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {job.position_type.name}
            </h1>
            <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
              {job.business.business_name}
            </p>
          </div>
          <span className={badgeClass}>{job.status}</span>
        </div>

        <div className="detail-grid">
          <div className="detail-field">
            <label>Salary</label>
            <p>
              ${job.salary_min}–${job.salary_max}/hr
            </p>
          </div>
          <div className="detail-field">
            <label>Start</label>
            <p>{new Date(job.start_time).toLocaleString()}</p>
          </div>
          <div className="detail-field">
            <label>End</label>
            <p>{new Date(job.end_time).toLocaleString()}</p>
          </div>
          {job.distance !== undefined && (
            <div className="detail-field">
              <label>Distance</label>
              <p>
                {job.distance} km · {job.eta} min
              </p>
            </div>
          )}
          {job.worker && (
            <div className="detail-field">
              <label>Worker</label>
              <p>
                {job.worker.first_name} {job.worker.last_name}
              </p>
            </div>
          )}
        </div>

        {job.note && (
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 6,
              }}
            >
              Note
            </p>
            <p style={{ fontSize: 14 }}>{job.note}</p>
          </div>
        )}

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        {isOpen && (
          <button
            className={`btn ${
              interested === true ? "btn-ghost" : "btn-primary"
            }`}
            onClick={toggleInterest}
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : interested === true
              ? "Withdraw interest"
              : "Express interest"}
          </button>
        )}
      </div>
    </div>
  );
}
