import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface Business {
  id: number;
  business_name: string;
  email: string;
  phone_number: string;
  postal_address: string;
}
interface BusinessesResponse { count: number; results: Business[]; }

const LIMIT = 10;

export default function PublicBusinesses() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("business_name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ sort, order, page: String(page), limit: String(LIMIT) });
    if (search) q.set("keyword", search);

    api.get<BusinessesResponse>(`/businesses?${q}`)
      .then((r) => { setBusinesses(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load businesses"))
      .finally(() => setLoading(false));
  }, [page, search, sort, order]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(keyword);
  }

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
        <h1 className="page-title">Businesses</h1>

        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            className="form-input"
            style={{ maxWidth: 280 }}
            placeholder="Search by name, address, phone…"
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
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="business_name">Name</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="order">Order</label>
            <select id="order" value={order} onChange={(e) => { setOrder(e.target.value as "asc" | "desc"); setPage(1); }}>
              <option value="asc">A → Z</option>
              <option value="desc">Z → A</option>
            </select>
          </div>
        </div>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
        {!loading && businesses.length === 0 && <div className="empty-state">No businesses found.</div>}

        <div className="item-list">
          {businesses.map((biz) => (
            <button key={biz.id} className="item-card" onClick={() => navigate(`/businesses/${biz.id}`)}>
              <div className="item-card-main">
                <span className="item-card-title">{biz.business_name}</span>
                <div className="item-card-sub">
                  {biz.postal_address && <span>{biz.postal_address}</span>}
                  {biz.phone_number && <><span>·</span><span>{biz.phone_number}</span></>}
                </div>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 18, alignSelf: "center" }}>›</span>
            </button>
          ))}
        </div>

        <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
      </main>
    </div>
  );
}
