import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface Job {
  id: number;
  status: string;
  position_type: { id: number; name: string };
  worker: { id: number; first_name: string; last_name: string } | null;
  salary_min: number;
  salary_max: number;
  start_time: string;
  end_time: string;
}
interface JobsResponse { count: number; results: Job[]; }

const LIMIT = 10;
const ALL_STATUSES = ["open", "filled", "expired", "completed", "canceled"];

export default function BusinessJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs]     = useState<Job[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // filters
  const [status, setStatus]       = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

  function buildQuery() {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (status) params.set("status", status);
    if (salaryMin) params.set("salary_min", salaryMin);
    if (salaryMax) params.set("salary_max", salaryMax);
    return params.toString();
  }

  useEffect(() => {
    setLoading(true);
    api.get<JobsResponse>(`/businesses/me/jobs?${buildQuery()}`)
      .then((r) => { setJobs(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, [page, status, salaryMin, salaryMax]);

  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  async function handleDelete(jobId: number) {
    if (!window.confirm("Delete this job? This cannot be undone.")) return;
    setDeleting(jobId);
    setError(null);
    try {
      await api.delete(`/businesses/me/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>My Jobs</h1>
        <button className="btn btn-primary" onClick={() => navigate("/business/jobs/new")}>+ New Job</button>
      </div>

      {/* Filters */}
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="status-filter">Status</label>
          <select id="status-filter" value={status} onChange={handleFilterChange(setStatus)}>
            <option value="">All</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="salary-min">Min salary</label>
          <input
            id="salary-min"
            type="number"
            placeholder="e.g. 15"
            value={salaryMin}
            onChange={handleFilterChange(setSalaryMin)}
            className="form-input"
            style={{ width: 100 }}
            min={0}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="salary-max">Max salary</label>
          <input
            id="salary-max"
            type="number"
            placeholder="e.g. 30"
            value={salaryMax}
            onChange={handleFilterChange(setSalaryMax)}
            className="form-input"
            style={{ width: 100 }}
            min={0}
          />
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!loading && jobs.length === 0 && <div className="empty-state">No jobs yet. Create your first one!</div>}

      <div className="item-list">
        {jobs.map((job) => (
          <div key={job.id} className="item-card" style={{ cursor: "default" }}>
            <div className="item-card-main">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="item-card-title">{job.position_type.name}</span>
                <span className={`badge badge-${job.status}`}>{job.status}</span>
              </div>
              <div className="item-card-sub">
                <span>${job.salary_min}–${job.salary_max}/hr</span>
                <span>·</span>
                <span>{new Date(job.start_time).toLocaleDateString()}</span>
                {job.worker && <><span>·</span><span>Worker: {job.worker.first_name} {job.worker.last_name}</span></>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/business/jobs/${job.id}/candidates`)}>
                Candidates
              </button>
              {job.status === "open" && (
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/business/jobs/${job.id}/edit`)}>
                  Edit
                </button>
              )}
              {(job.status === "open" || job.status === "expired") && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(job.id)}
                  disabled={deleting === job.id}
                >
                  {deleting === job.id ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
    </div>
  );
}
