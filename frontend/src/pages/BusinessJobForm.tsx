import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

interface PositionType { id: number; name: string; }
interface PositionTypesResponse { count: number; results: PositionType[]; }
interface Job {
  id: number; status: string; note: string | null;
  position_type: { id: number; name: string };
  salary_min: number; salary_max: number;
  start_time: string; end_time: string;
}

// Shared form used for both /business/jobs/new and /business/jobs/:id/edit
export default function BusinessJobForm() {
  const navigate        = useNavigate();
  const { id }          = useParams<{ id: string }>();
  const isEdit          = !!id;

  const [positionTypes, setPositionTypes] = useState<PositionType[]>([]);
  const [form, setForm] = useState({
    position_type_id: "",
    salary_min: "",
    salary_max: "",
    start_time: "",
    end_time: "",
    note: "",
  });
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<PositionTypesResponse>("/position-types?limit=100")
      .then((r) => setPositionTypes(r.results)).catch(() => {});

    if (isEdit) {
      api.get<Job>(`/jobs/${id}`)
        .then((job) => setForm({
          position_type_id: String(job.position_type.id),
          salary_min:  String(job.salary_min),
          salary_max:  String(job.salary_max),
          start_time:  new Date(job.start_time).toISOString().slice(0, 16),
          end_time:    new Date(job.end_time).toISOString().slice(0, 16),
          note:        job.note ?? "",
        }))
        .catch(() => setError("Failed to load job"));
    }
  }, [id, isEdit]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isEdit) {
        await api.patch(`/businesses/me/jobs/${id}`, {
          salary_min: parseFloat(form.salary_min),
          salary_max: parseFloat(form.salary_max),
          start_time: new Date(form.start_time).toISOString(),
          end_time:   new Date(form.end_time).toISOString(),
          note:       form.note,
        });
      } else {
        await api.post("/businesses/me/jobs", {
          position_type_id: parseInt(form.position_type_id),
          salary_min: parseFloat(form.salary_min),
          salary_max: parseFloat(form.salary_max),
          start_time: new Date(form.start_time).toISOString(),
          end_time:   new Date(form.end_time).toISOString(),
          note:       form.note,
        });
      }
      navigate("/business/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate("/business/jobs")}>← Back to jobs</button>
      <h1 className="page-title">{isEdit ? "Edit Job" : "New Job"}</h1>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit}>
          {!isEdit && (
            <div className="form-group">
              <label htmlFor="position_type_id">Position type</label>
              <select id="position_type_id" name="position_type_id" className="form-select" required
                value={form.position_type_id} onChange={handleChange}>
                <option value="">Select…</option>
                {positionTypes.map((pt) => (
                  <option key={pt.id} value={String(pt.id)}>{pt.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div className="form-group">
              <label htmlFor="salary_min">Min salary ($/hr)</label>
              <input id="salary_min" name="salary_min" className="form-input" type="number" min="0" step="0.01" required
                value={form.salary_min} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="salary_max">Max salary ($/hr)</label>
              <input id="salary_max" name="salary_max" className="form-input" type="number" min="0" step="0.01" required
                value={form.salary_max} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="start_time">Start time</label>
            <input id="start_time" name="start_time" className="form-input" type="datetime-local" required
              value={form.start_time} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="end_time">End time</label>
            <input id="end_time" name="end_time" className="form-input" type="datetime-local" required
              value={form.end_time} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="note">Note <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
            <textarea id="note" name="note" className="form-textarea"
              value={form.note} onChange={handleChange} />
          </div>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save changes" : "Create job"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate("/business/jobs")}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
