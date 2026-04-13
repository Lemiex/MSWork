import { useState, useEffect, type FormEvent } from "react";
import { api } from "../api";

interface ConfigField {
  key: string;
  label: string;
  endpoint: string;
  description: string;
}

type SystemConfig = Record<string, number>;

const FIELDS: ConfigField[] = [
  {
    key: "reset_cooldown",
    label: "Password Reset Cooldown",
    endpoint: "/system/reset-cooldown",
    description: "Minimum seconds between password reset requests (0 = no cooldown).",
  },
  {
    key: "negotiation_window",
    label: "Negotiation Window",
    endpoint: "/system/negotiation-window",
    description: "Seconds the negotiation window stays open after being created.",
  },
  {
    key: "job_start_window",
    label: "Job Start Window",
    endpoint: "/system/job-start-window",
    description: "Hours before job start time when negotiation can begin.",
  },
  {
    key: "availability_timeout",
    label: "Availability Timeout",
    endpoint: "/system/availability-timeout",
    description: "Seconds of inactivity before a user is considered unavailable.",
  },
];

export default function AdminSystem() {
  const [current, setCurrent] = useState<SystemConfig | null>(null);
  const [values, setValues]   = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.get<SystemConfig>("/system")
      .then(setCurrent)
      .catch(() => setError("Failed to load current configuration"));
  }, []);

  function handleChange(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave(e: FormEvent, field: ConfigField) {
    e.preventDefault();
    const raw = values[field.key];
    if (raw === undefined || raw === "") return;
    const num = Number(raw);
    if (isNaN(num)) {
      setError(`${field.label} must be a number`);
      return;
    }
    setSaving(field.key);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(field.endpoint, { [field.key]: num });
      setCurrent((prev) => prev ? { ...prev, [field.key]: num } : prev);
      setSuccess(`${field.label} updated to ${num}`);
      setValues((prev) => ({ ...prev, [field.key]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">System Configuration</h1>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {success && <p className="alert alert-success" role="status">{success}</p>}

      <div style={{ display: "grid", gap: 16 }}>
        {FIELDS.map((field) => (
          <div key={field.key} className="card">
            <p className="card-title">{field.label}</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{field.description}</p>
            {current !== null && (
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                Current: <span style={{ color: "var(--accent)" }}>{current[field.key]}</span>
              </p>
            )}
            <form onSubmit={(e) => handleSave(e, field)} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: 200 }}>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="New value"
                  value={values[field.key] ?? ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving === field.key}>
                {saving === field.key ? "Saving…" : "Update"}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
