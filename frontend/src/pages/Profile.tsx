import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { api } from "../api";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

interface UserProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  postal_address: string | null;
  birthday: string | null;
  biography: string | null;
  avatar: string | null;
  resume: string | null;
  available: boolean;
  suspended: boolean;
}

interface ApprovedQual {
  id: number;
  status: string;
  position_type: { id: number; name: string };
}

export default function Profile() {
  const [profile, setProfile]         = useState<UserProfile | null>(null);
  const [approvedQuals, setApprovedQuals] = useState<ApprovedQual[]>([]);
  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState<Partial<UserProfile>>({});
  const [error, setError]             = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<UserProfile>("/users/me").then(setProfile).catch(() => setError("Failed to load profile"));
    api.get<{ count: number; results: ApprovedQual[] }>("/users/me/qualifications")
      .then((r) => setApprovedQuals(r.results.filter((q) => q.status === "approved")))
      .catch(() => {});
  }, []);

  function startEdit() {
    if (!profile) return;
    setForm({
      first_name: profile.first_name, last_name: profile.last_name,
      phone_number: profile.phone_number, postal_address: profile.postal_address,
      birthday: profile.birthday, biography: profile.biography,
    });
    setEditing(true);
    setError(null);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<UserProfile>("/users/me", form);
      setProfile((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailable() {
    if (!profile) return;
    const next = !profile.available;
    try {
      await api.patch("/users/me/available", { available: next });
      setProfile((prev) => prev ? { ...prev, available: next } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update availability");
    }
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { avatar } = await api.upload<{ avatar: string }>("/users/me/avatar", fd);
      setProfile((prev) => prev ? { ...prev, avatar } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed");
    } finally {
      setUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  }

  async function handleResumeUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { resume } = await api.upload<{ resume: string }>("/users/me/resume", fd);
      setProfile((prev) => prev ? { ...prev, resume } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume upload failed");
    } finally {
      setUploading(false);
      if (resumeRef.current) resumeRef.current.value = "";
    }
  }

  if (!profile) return <p style={{ padding: 32, color: "var(--text-muted)" }}>Loading…</p>;

  const initials = `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();

  return (
    <div>
      <h1 className="page-title">My Profile</h1>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <div className="card">
        {/* Header */}
        <div className="profile-header">
          <div>
            {profile.avatar
              ? <img className="avatar-img" src={`${BASE_URL}${profile.avatar}`} alt="Avatar" />
              : <div className="avatar-placeholder">{initials}</div>
            }
          </div>
          <div className="profile-info">
            <p className="profile-name">{profile.first_name} {profile.last_name}</p>
            <p className="profile-email">{profile.email}</p>
            <div className="profile-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => avatarRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : "Change avatar"}
              </button>
              <input ref={avatarRef} type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={handleAvatarUpload} />
            </div>
          </div>
        </div>

        {/* Availability */}
        {!profile.suspended && (
          <div className="availability-row">
            <span>Available for work:</span>
            <span style={{ fontWeight: 600, color: profile.available ? "var(--success)" : "var(--text-muted)" }}>
              {profile.available ? "Yes" : "No"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={toggleAvailable}>
              {profile.available ? "Set unavailable" : "Set available"}
            </button>
          </div>
        )}

        {/* View mode */}
        {!editing && (
          <>
            <div className="detail-grid">
              <div className="detail-field"><label>Phone</label><p>{profile.phone_number ?? "—"}</p></div>
              <div className="detail-field"><label>Address</label><p>{profile.postal_address ?? "—"}</p></div>
              <div className="detail-field"><label>Birthday</label><p>{profile.birthday ?? "—"}</p></div>
            </div>

            {profile.biography && (
              <>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Biography</p>
                <p style={{ fontSize: 14, marginBottom: 20 }}>{profile.biography}</p>
              </>
            )}

            {/* Approved qualifications summary */}
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              Approved Qualifications
            </p>
            {approvedQuals.length === 0
              ? <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>None yet.</p>
              : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {approvedQuals.map((q) => (
                    <span key={q.id} className="badge badge-approved">{q.position_type.name}</span>
                  ))}
                </div>
              )
            }

            <div className="inline-row">
              {profile.resume
                ? <a className="btn btn-ghost btn-sm" href={`${BASE_URL}${profile.resume}`} target="_blank" rel="noreferrer">View resume</a>
                : <span style={{ fontSize: 14, color: "var(--text-muted)" }}>No resume uploaded</span>
              }
              <button className="btn btn-secondary btn-sm" onClick={() => resumeRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : profile.resume ? "Replace resume" : "Upload resume"}
              </button>
              <input ref={resumeRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleResumeUpload} />
            </div>

            <hr className="divider" />
            <button className="btn btn-primary btn-sm" onClick={startEdit}>Edit profile</button>
          </>
        )}

        {/* Edit mode */}
        {editing && (
          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div className="form-group">
                <label htmlFor="first_name">First name</label>
                <input id="first_name" name="first_name" className="form-input" type="text" required
                  value={form.first_name ?? ""} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Last name</label>
                <input id="last_name" name="last_name" className="form-input" type="text" required
                  value={form.last_name ?? ""} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="phone_number">Phone number</label>
              <input id="phone_number" name="phone_number" className="form-input" type="tel"
                value={form.phone_number ?? ""} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="postal_address">Postal address</label>
              <input id="postal_address" name="postal_address" className="form-input" type="text"
                value={form.postal_address ?? ""} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="birthday">Birthday</label>
              <input id="birthday" name="birthday" className="form-input" type="date"
                value={form.birthday ?? ""} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="biography">Biography</label>
              <textarea id="biography" name="biography" className="form-textarea"
                value={form.biography ?? ""} onChange={handleChange} />
            </div>

            {error && <p className="alert alert-error" role="alert">{error}</p>}

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
