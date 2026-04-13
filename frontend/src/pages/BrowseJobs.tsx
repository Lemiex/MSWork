import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface PositionType { id: number; name: string; }
interface Job {
  id: number;
  status: string;
  position_type: PositionType;
  business: { id: number; business_name: string };
  salary_min: number;
  salary_max: number;
  start_time: string;
  end_time: string;
}
interface Qualification { id: number; status: string; position_type: { id: number; name: string }; }
interface JobsResponse { count: number; results: Job[]; }

const SORT_OPTIONS = [
  { value: "start_time", label: "Start time" },
  { value: "salary_min", label: "Min salary" },
  { value: "salary_max", label: "Max salary" },
  { value: "updatedAt",  label: "Recently updated" },
];
const LIMIT = 10;

export default function BrowseJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs]                         = useState<Job[]>([]);
  const [total, setTotal]                       = useState(0);
  const [page, setPage]                         = useState(1);
  const [approvedPTs, setApprovedPTs]           = useState<PositionType[]>([]);
  const [approvedPTIds, setApprovedPTIds]       = useState<number[]>([]);
  const [filterPT, setFilterPT]                 = useState("");
  const [sort, setSort]                         = useState("start_time");
  const [order, setOrder]                       = useState<"asc" | "desc">("asc");
  const [error, setError]                       = useState<string | null>(null);
  const [loading, setLoading]                   = useState(false);
  const [qualsLoaded, setQualsLoaded]           = useState(false);

  useEffect(() => {
    api.get<{ count: number; results: Qualification[] }>("/users/me/qualifications")
      .then((r) => {
        const approved = r.results.filter((q) => q.status === "approved");
        setApprovedPTs(approved.map((q) => q.position_type));
        setApprovedPTIds(approved.map((q) => q.position_type.id));
      })
      .catch(() => {})
      .finally(() => setQualsLoaded(true));
  }, []);

  useEffect(() => {
    if (!qualsLoaded) return;
    if (approvedPTIds.length === 0) { setJobs([]); setTotal(0); return; }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ sort, order, page: String(page), limit: String(LIMIT) });
    if (filterPT) {
      params.set("position_type_id", filterPT);
    } else {
      params.set("position_type_ids", approvedPTIds.join(","));
    }
    api.get<JobsResponse>(`/jobs?${params}`)
      .then((r) => { setJobs(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, [page, sort, order, filterPT, approvedPTIds, qualsLoaded]);

  function handleFilterChange() { setPage(1); }

  if (qualsLoaded && approvedPTIds.length === 0) {
    return (
      <div>
        <h1 className="page-title">Browse Jobs</h1>
        <div className="empty-state">
          You have no approved qualifications. Get a qualification approved to browse matching jobs.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Browse Jobs</h1>

      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="pt-filter">Position type</label>
          <select id="pt-filter" value={filterPT}
            onChange={(e) => { setFilterPT(e.target.value); handleFilterChange(); }}>
            <option value="">All</option>
            {approvedPTs.map((pt) => (
              <option key={pt.id} value={String(pt.id)}>{pt.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => { setSort(e.target.value); handleFilterChange(); }}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="order">Order</label>
          <select id="order" value={order} onChange={(e) => { setOrder(e.target.value as "asc" | "desc"); handleFilterChange(); }}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!loading && jobs.length === 0 && <div className="empty-state">No jobs found matching your filters.</div>}

      <div className="item-list">
        {jobs.map((job) => (
          <button key={job.id} className="item-card" onClick={() => navigate(`/jobs/${job.id}`)}>
            <div className="item-card-main">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="item-card-title">{job.position_type.name}</span>
                <span className="badge badge-open">open</span>
              </div>
              <div style={{ fontWeight: 500, fontSize: 14, color: "var(--text-muted)", marginBottom: 2 }}>
                {job.business.business_name}
              </div>
              <div className="item-card-sub">
                <span>${job.salary_min}–${job.salary_max}/hr</span>
                <span>·</span>
                <span>{new Date(job.start_time).toLocaleDateString()} – {new Date(job.end_time).toLocaleDateString()}</span>
              </div>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: 18, alignSelf: "center" }}>›</span>
          </button>
        ))}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
    </div>
  );
}
