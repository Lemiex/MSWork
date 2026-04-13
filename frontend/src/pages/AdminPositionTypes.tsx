import { useState, useEffect, type FormEvent } from "react";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface PositionType {
  id: number;
  name: string;
  description: string;
  hidden: boolean;
  num_qualified: number;
}
interface PTResponse { count: number; results: PositionType[]; }

const LIMIT = 10;

export default function AdminPositionTypes() {
  const [pts, setPts]           = useState<PositionType[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [acting, setActing]     = useState<number | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newDesc, setNewDesc]       = useState("");
  const [newHidden, setNewHidden]   = useState(true);
  const [creating, setCreating]     = useState(false);

  // Edit form
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editName, setEditName]       = useState("");
  const [editDesc, setEditDesc]       = useState("");
  const [editHidden, setEditHidden]   = useState(false);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    fetchPTs();
  }, [page]);

  function fetchPTs() {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    api.get<PTResponse>(`/position-types?${q}`)
      .then((r) => { setPts(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load position types"))
      .finally(() => setLoading(false));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post("/position-types", { name: newName, description: newDesc, hidden: newHidden });
      setNewName(""); setNewDesc(""); setNewHidden(true); setShowCreate(false);
      fetchPTs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create position type");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(pt: PositionType) {
    setEditingId(pt.id);
    setEditName(pt.name);
    setEditDesc(pt.description);
    setEditHidden(pt.hidden);
    setError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/position-types/${editingId}`, { name: editName, description: editDesc, hidden: editHidden });
      setEditingId(null);
      fetchPTs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update position type");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pt: PositionType) {
    if (!confirm(`Delete "${pt.name}"? This cannot be undone.`)) return;
    setActing(pt.id);
    setError(null);
    try {
      await api.delete(`/position-types/${pt.id}`);
      fetchPTs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete position type");
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Position Types</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Position Type"}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p className="card-title">Create Position Type</p>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="new-name">Name</label>
              <input id="new-name" className="form-input" type="text" required
                value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="new-desc">Description</label>
              <textarea id="new-desc" className="form-textarea" required
                value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={newHidden} onChange={(e) => setNewHidden(e.target.checked)} />
                Hidden (not visible to regular users)
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </button>
          </form>
        </div>
      )}

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!loading && pts.length === 0 && <div className="empty-state">No position types found.</div>}

      <div className="item-list">
        {pts.map((pt) => {
          if (editingId === pt.id) {
            return (
              <div key={pt.id} className="card" style={{ marginBottom: 8 }}>
                <form onSubmit={handleSaveEdit}>
                  <div className="form-group">
                    <label htmlFor={`edit-name-${pt.id}`}>Name</label>
                    <input id={`edit-name-${pt.id}`} className="form-input" type="text" required
                      value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`edit-desc-${pt.id}`}>Description</label>
                    <textarea id={`edit-desc-${pt.id}`} className="form-textarea" required
                      value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={editHidden} onChange={(e) => setEditHidden(e.target.checked)} />
                      Hidden
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            );
          }

          return (
            <div key={pt.id} className="item-card">
              <div className="item-card-main">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span className="item-card-title">{pt.name}</span>
                  {pt.hidden
                    ? <span className="badge badge-created">Hidden</span>
                    : <span className="badge badge-approved">Visible</span>
                  }
                </div>
                <div className="item-card-sub">
                  <span>{pt.description}</span>
                  <span>·</span>
                  <span>{pt.num_qualified} qualification{pt.num_qualified !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => startEdit(pt)}>Edit</button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={acting === pt.id || pt.num_qualified > 0}
                  onClick={() => handleDelete(pt)}
                  title={pt.num_qualified > 0 ? "Cannot delete: has qualified users" : "Delete"}
                >
                  {acting === pt.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
    </div>
  );
}
