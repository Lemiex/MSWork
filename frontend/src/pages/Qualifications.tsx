import { useState, useEffect, useRef, type FormEvent } from "react";
import { api } from "../api";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

interface PositionType { id: number; name: string; description: string; }
interface Qualification {
  id: number; status: string; note: string; document: string | null;
  position_type: { id: number; name: string }; updatedAt: string;
}
interface PositionTypesResponse { count: number; results: PositionType[]; }

const USER_TRANSITIONS: Record<string, string[]> = {
  created:  ["submitted"],
  rejected: ["revised"],
  approved: ["revised"],
};

export default function Qualifications() {
  const [quals, setQuals]                 = useState<Qualification[]>([]);
  const [positionTypes, setPositionTypes] = useState<PositionType[]>([]);
  const [error, setError]                 = useState<string | null>(null);
  const [newPT, setNewPT]                 = useState("");
  const [newNote, setNewNote]             = useState("");
  const [creating, setCreating]           = useState(false);
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [editNote, setEditNote]           = useState("");
  const [saving, setSaving]               = useState(false);
  const [uploadingId, setUploadingId]     = useState<number | null>(null);
  const [pendingUploadId, setPendingUploadId] = useState<number | null>(null);
  const docRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<PositionTypesResponse>("/position-types?limit=100")
      .then((r) => setPositionTypes(r.results)).catch(() => {});
    api.get<{ count: number; results: Qualification[] }>("/users/me/qualifications")
      .then((r) => setQuals(r.results)).catch(() => {});
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newPT) return;
    setCreating(true);
    setError(null);
    try {
      const q = await api.post<Qualification>("/qualifications", {
        position_type_id: Number(newPT), note: newNote,
      });
      setQuals((prev) => [...prev, q]);
      setNewPT("");
      setNewNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create qualification");
    } finally {
      setCreating(false);
    }
  }

  async function submitStatus(qual: Qualification, status: string) {
    setError(null);
    try {
      const updated = await api.patch<Qualification>(`/qualifications/${qual.id}`, { status });
      setQuals((prev) => prev.map((q) => q.id === updated.id ? updated : q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function saveNote(id: number) {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<Qualification>(`/qualifications/${id}`, { note: editNote });
      setQuals((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const qualId = pendingUploadId;
    if (!file || qualId === null) return;
    setUploadingId(qualId);
    setPendingUploadId(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { document } = await api.upload<{ document: string }>(`/qualifications/${qualId}/document`, fd);
      setQuals((prev) => prev.map((q) => q.id === qualId ? { ...q, document } : q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingId(null);
      if (docRef.current) docRef.current.value = "";
    }
  }

  const availablePTs = positionTypes.filter((pt) => !quals.some((q) => q.position_type.id === pt.id));

  return (
    <div>
      <h1 className="page-title">My Qualifications</h1>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {/* Create form */}
      {availablePTs.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p className="card-title">Apply for a position type</p>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="new-pt">Position type</label>
              <select id="new-pt" className="form-select" value={newPT}
                onChange={(e) => setNewPT(e.target.value)} required>
                <option value="">Select…</option>
                {availablePTs.map((pt) => (
                  <option key={pt.id} value={String(pt.id)}>{pt.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="new-note">Note <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <textarea id="new-note" className="form-textarea" value={newNote}
                onChange={(e) => setNewNote(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? "Submitting…" : "Create qualification"}
            </button>
          </form>
        </div>
      )}

      {quals.length === 0 && <div className="empty-state">No qualifications yet. Create one above.</div>}

      <div>
        {quals.map((q) => {
          const nextStatuses = USER_TRANSITIONS[q.status] ?? [];
          const isUploading  = uploadingId === q.id;
          const isEditing    = editingId === q.id;

          return (
            <div key={q.id} className="qual-card">
              <div className="qual-header">
                <span className="qual-title">{q.position_type.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge badge-${q.status}`}>{q.status}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(q.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Note */}
              {isEditing ? (
                <div>
                  <textarea className="form-textarea" style={{ marginBottom: 8 }}
                    value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                  <div className="form-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => saveNote(q.id)} disabled={saving}>
                      {saving ? "Saving…" : "Save note"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="qual-note" style={{ marginBottom: 10 }}>
                  {q.note || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No note</span>}
                </div>
              )}

              <div className="qual-actions">
                {/* Document */}
                {q.document
                  ? <a className="btn btn-ghost btn-sm" href={`${BASE_URL}${q.document}`} target="_blank" rel="noreferrer">View document</a>
                  : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No document</span>
                }
                <input ref={docRef} type="file" accept="application/pdf" style={{ display: "none" }}
                  onChange={handleDocUpload} />
                <button className="btn btn-secondary btn-sm" type="button"
                  onClick={() => { setPendingUploadId(q.id); docRef.current?.click(); }} disabled={isUploading}>
                  {isUploading ? "Uploading…" : q.document ? "Replace" : "Upload PDF"}
                </button>

                {!isEditing && (
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => { setEditingId(q.id); setEditNote(q.note ?? ""); }}>
                    Edit note
                  </button>
                )}

                {nextStatuses.map((s) => (
                  <button key={s} className="btn btn-primary btn-sm" onClick={() => submitStatus(q, s)}>
                    {s === "submitted" ? "Submit for review" : "Revise"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
