import { useState, useEffect } from "react";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface Business {
  id: number;
  business_name: string;
  owner_name: string;
  email: string;
  activated: boolean;
  verified: boolean;
  role: string;
  phone_number: string;
  postal_address: string;
}
interface BusinessesResponse { count: number; results: Business[]; }

const LIMIT = 10;

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [filterActivated, setFilterActivated] = useState("");
  const [filterVerified, setFilterVerified] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) q.set("keyword", search);
    if (filterActivated) q.set("activated", filterActivated);
    if (filterVerified) q.set("verified", filterVerified);

    api.get<BusinessesResponse>(`/businesses?${q}`)
      .then((r) => { setBusinesses(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load businesses"))
      .finally(() => setLoading(false));
  }, [page, search, filterActivated, filterVerified]);

  async function toggleVerified(biz: Business) {
    setActing(biz.id);
    setError(null);
    try
    {
      const updated = await api.patch<Business>(`/businesses/${biz.id}/verified`, { verified: !biz.verified });
      setBusinesses((prev) => prev.map((b) => b.id === biz.id ? { ...b, verified: updated.verified } : b));
    } catch (err)
    {
      setError(err instanceof Error ? err.message : "Failed to update business");
    } finally
    {
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
      <h1 className="page-title">Business Management</h1>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
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
          <label htmlFor="filter-activated">Activated</label>
          <select id="filter-activated" value={filterActivated}
            onChange={(e) => { setFilterActivated(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filter-verified">Verified</label>
          <select id="filter-verified" value={filterVerified}
            onChange={(e) => { setFilterVerified(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!loading && businesses.length === 0 && <div className="empty-state">No businesses found.</div>}

      <div className="item-list">
        {businesses.map((biz) => (
          <div key={biz.id} className="item-card">
            <div className="item-card-main">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="item-card-title">{biz.business_name}</span>
                {!biz.activated && <span className="badge badge-created">Not activated</span>}
                {biz.verified
                  ? <span className="badge badge-approved">Verified</span>
                  : <span className="badge badge-submitted">Unverified</span>
                }
              </div>
              <div className="item-card-sub">
                <span>{biz.email}</span>
                <span>·</span>
                <span>Owner: {biz.owner_name}</span>
                {biz.phone_number && <><span>·</span><span>{biz.phone_number}</span></>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                className={`btn btn-sm ${biz.verified ? "btn-ghost" : "btn-primary"}`}
                disabled={acting === biz.id}
                onClick={() => toggleVerified(biz)}
              >
                {acting === biz.id ? "…" : biz.verified ? "Unverify" : "Verify"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
    </div>
  );
}
