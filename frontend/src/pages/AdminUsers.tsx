import { useState, useEffect } from "react";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  activated: boolean;
  suspended: boolean;
  role: string;
  phone_number: string | null;
  postal_address: string | null;
}
interface UsersResponse { count: number; results: User[]; }

const LIMIT = 10;

export default function AdminUsers() {
  const [users, setUsers]       = useState<User[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [keyword, setKeyword]   = useState("");
  const [search, setSearch]     = useState("");
  const [filterActivated, setFilterActivated] = useState("");
  const [filterSuspended, setFilterSuspended] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [acting, setActing]     = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) q.set("keyword", search);
    if (filterActivated) q.set("activated", filterActivated);
    if (filterSuspended) q.set("suspended", filterSuspended);

    api.get<UsersResponse>(`/users?${q}`)
      .then((r) => { setUsers(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, [page, search, filterActivated, filterSuspended]);

  async function toggleSuspended(user: User) {
    setActing(user.id);
    setError(null);
    try {
      const updated = await api.patch<User>(`/users/${user.id}/suspended`, { suspended: !user.suspended });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, suspended: updated.suspended } : u));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
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
      <h1 className="page-title">User Management</h1>

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
          <label htmlFor="filter-suspended">Suspended</label>
          <select id="filter-suspended" value={filterSuspended}
            onChange={(e) => { setFilterSuspended(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!loading && users.length === 0 && <div className="empty-state">No users found.</div>}

      <div className="item-list">
        {users.map((u) => (
          <div key={u.id} className="item-card">
            <div className="item-card-main">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="item-card-title">{u.first_name} {u.last_name}</span>
                {!u.activated && <span className="badge badge-created">Not activated</span>}
                {u.suspended && <span className="badge badge-rejected">Suspended</span>}
              </div>
              <div className="item-card-sub">
                <span>{u.email}</span>
                {u.phone_number && <><span>·</span><span>{u.phone_number}</span></>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                className={`btn btn-sm ${u.suspended ? "btn-primary" : "btn-ghost"}`}
                disabled={acting === u.id}
                onClick={() => toggleSuspended(u)}
              >
                {acting === u.id ? "…" : u.suspended ? "Unsuspend" : "Suspend"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
    </div>
  );
}
