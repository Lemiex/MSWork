import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { api } from "../api";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface BusinessProfile {
  id: number;
  business_name: string;
  owner_name: string;
  email: string;
  phone_number: string;
  postal_address: string;
  location: { lat: number; lon: number };
  verified: boolean;
  biography: string | null;
  avatar: string | null;
}

export default function BusinessProfile() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<BusinessProfile & { lat: string; lon: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarTs, setAvatarTs] = useState<number>(() => Date.now());
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<BusinessProfile>("/businesses/me")
      .then(setProfile)
      .catch(() => setError("Failed to load profile"));
  }, []);

  function startEdit() {
    if (!profile) return;
    setForm({
      business_name: profile.business_name,
      owner_name: profile.owner_name,
      phone_number: profile.phone_number,
      postal_address: profile.postal_address,
      biography: profile.biography,
      lat: String(profile.location.lat),
      lon: String(profile.location.lon),
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
    try
    {
      const body: Record<string, unknown> = {};
      if (form.business_name) body.business_name = form.business_name;
      if (form.owner_name) body.owner_name = form.owner_name;
      if (form.phone_number) body.phone_number = form.phone_number;
      if (form.postal_address) body.postal_address = form.postal_address;
      if (form.biography !== undefined) body.biography = form.biography;
      if (form.lat && form.lon) body.location = { lat: parseFloat(form.lat as string), lon: parseFloat(form.lon as string) };

      const updated = await api.patch<BusinessProfile>("/businesses/me", body);
      setProfile((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
    } catch (err)
    {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally
    {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try
    {
      const fd = new FormData();
      fd.append("file", file);
      const { avatar } = await api.upload<{ avatar: string }>("/businesses/me/avatar", fd);
      setProfile((prev) => prev ? { ...prev, avatar } : prev);
      setAvatarTs(Date.now());
    } catch (err)
    {
      setError(err instanceof Error ? err.message : "Avatar upload failed");
    } finally
    {
      setUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  }

  if (!profile) return <p style={{ padding: 32, color: "var(--text-muted)" }}>Loading…</p>;

  const initials = profile.business_name.slice(0, 2).toUpperCase();

  return (
    <div>
      <h1 className="page-title">Business Profile</h1>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <div className="card">
        <div className="profile-header">
          {profile.avatar
            ? <img className="avatar-img" src={`${BASE_URL}${profile.avatar}?t=${avatarTs}`} alt="Avatar" style={{ borderRadius: "var(--radius)", width: 64, height: 64, objectFit: "cover" }} />
            : <div className="avatar-placeholder" style={{ borderRadius: "var(--radius)" }}>{initials}</div>
          }
          <div className="profile-info">
            <p className="profile-name">{profile.business_name}</p>
            <p className="profile-email">{profile.email}</p>
            <div style={{ marginTop: 6 }}>
              {profile.verified
                ? <span className="badge badge-approved">Verified</span>
                : <span className="badge badge-submitted">Awaiting verification — contact admin to create jobs</span>
              }
            </div>
          </div>
        </div>

        {!editing && (
          <>
            <div className="detail-grid">
              <div className="detail-field"><label>Owner</label><p>{profile.owner_name}</p></div>
              <div className="detail-field"><label>Phone</label><p>{profile.phone_number}</p></div>
              <div className="detail-field"><label>Address</label><p>{profile.postal_address}</p></div>
              <div className="detail-field"><label>Location</label><p>{profile.location.lat}, {profile.location.lon}</p></div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Biography</p>
            <p style={{ fontSize: 14, marginBottom: 20 }}>{profile.biography || "No biography yet. Click Edit profile to add one."}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn btn-primary btn-sm" onClick={startEdit}>Edit profile</button>
              <button className="btn btn-secondary btn-sm" onClick={() => avatarRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : "Change avatar"}
              </button>
              <input ref={avatarRef} type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={handleAvatarUpload} />
            </div>
          </>
        )}

        {editing && (
          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div className="form-group">
                <label htmlFor="business_name">Business name</label>
                <input id="business_name" name="business_name" className="form-input" type="text"
                  value={form.business_name ?? ""} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="owner_name">Owner name</label>
                <input id="owner_name" name="owner_name" className="form-input" type="text"
                  value={form.owner_name ?? ""} onChange={handleChange} />
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div className="form-group">
                <label htmlFor="lat">Latitude</label>
                <input id="lat" name="lat" className="form-input" type="number" step="any"
                  value={form.lat ?? ""} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="lon">Longitude</label>
                <input id="lon" name="lon" className="form-input" type="number" step="any"
                  value={form.lon ?? ""} onChange={handleChange} />
              </div>
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
