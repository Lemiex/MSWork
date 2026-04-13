import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface Qualification {
  id: number;
  status: string;
  user: { id: number; first_name: string; last_name: string };
  position_type: { id: number; name: string };
  updatedAt: string;
}
interface QualsResponse { count: number; results: Qualification[]; }

const LIMIT = 10;

export default function AdminQualifications() {
  const navigate = useNavigate();
  const [quals, setQuals]         = useState<Qualification[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [keyword, setKeyword]     = useState("");
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [acting, setActing]       = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) q.set("keyword", search);
    if (filterStatus) q.set("status", filterStatus);
    api.get<QualsResponse>(`/qualifications?${q}`)
      .then((r) => { setQuals(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load qualifications"))
      .finally(() => setLoading(false));
  }, [page, search, filterStatus]);

  async function decide(id: number, status: "approved" | "rejected") {
    setActing(id);
    setError(null);
    try {
      const updated = await api.patch<Qualification>(`/qualifications/${id}`, { status });
      setQuals((prev) => prev.map((q) => q.id === id ? { ...q, status: updated.status } : q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update qualification");
    } finally {
      setActing(null);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(keyword);
  }

  return (
    <div>
      <h1 className="page-title">Qualification Reviews</h1>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="Search by name, email, phone…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">Search</button>
        {search && (
          <button className="btn btn-ghost" type="button" onClick={() => { setSearch(""); setKeyword(""); setPage(1); }}>
            Clear
          </button>
        )}
      </form>

      <div className="filter-row" style={{ marginBottom: 20 }}>
        <div className="filter-group">
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="created">Created</option>
            <option value="submitted">Submitted</option>
            <option value="revised">Revised</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!loading && quals.length === 0 && (
        <div className="empty-state">No qualifications found.</div>
      )}

      <div className="item-list">
        {quals.map((q) => (
          <button key={q.id} className="item-card" onClick={() => navigate(`/admin/qualifications/${q.id}`)}>
            <div className="item-card-main">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="item-card-title">{q.user.first_name} {q.user.last_name}</span>
                <span className={`badge badge-${q.status}`}>{q.status}</span>
              </div>
              <div className="item-card-sub">
                <span>{q.position_type.name}</span>
                <span>·</span>
                <span>Updated {new Date(q.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={acting === q.id}
                onClick={(e) => { e.stopPropagation(); decide(q.id, "approved"); }}
              >
                Approve
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={acting === q.id}
                onClick={(e) => { e.stopPropagation(); decide(q.id, "rejected"); }}
              >
                Reject
              </button>
            </div>
          </button>
        ))}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
    </div>
  );
}
