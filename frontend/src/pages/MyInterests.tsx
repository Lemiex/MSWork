import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface Interest {
  interest_id: number;
  mutual: boolean;
  job: {
    id: number;
    status: string;
    position_type: { id: number; name: string };
    business: { id: number; business_name: string };
    salary_min: number;
    salary_max: number;
    start_time: string;
    end_time: string;
  };
}
interface InterestsResponse { count: number; results: Interest[]; }

const LIMIT = 10;

export default function MyInterests() {
  const navigate = useNavigate();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [error, setError]         = useState<string | null>(null);
  const [starting, setStarting]   = useState<number | null>(null);

  useEffect(() => {
    api.get<InterestsResponse>(`/users/me/interests?page=${page}&limit=${LIMIT}`)
      .then((r) => { setInterests(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load interests"));
  }, [page]);

  async function startNegotiation(interest_id: number) {
    setStarting(interest_id);
    setError(null);
    try {
      const neg = await api.post<{ id: number }>("/negotiations", { interest_id });
      navigate(`/negotiation/${neg.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start negotiation");
    } finally {
      setStarting(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">My Interests</h1>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {interests.length === 0 && <div className="empty-state">You haven't expressed interest in any jobs yet.</div>}

      <div className="item-list">
        {interests.map(({ interest_id, mutual, job }) => (
          <div key={interest_id} className="item-card">
            <div
              className="item-card-main"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/jobs/${job.id}`)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="item-card-title">{job.position_type.name}</span>
                <span className={`badge badge-${job.status}`}>{job.status}</span>
                {mutual && <span className="badge badge-approved">Mutual</span>}
              </div>
              <div style={{ fontWeight: 500, fontSize: 14, color: "var(--text-muted)", marginBottom: 2 }}>
                {job.business.business_name}
              </div>
              <div className="item-card-sub">
                <span>${job.salary_min}–${job.salary_max}/hr</span>
                <span>·</span>
                <span>{new Date(job.start_time).toLocaleDateString()}</span>
              </div>
            </div>

            {mutual && job.status === "open" ? (
              <button
                className="btn btn-primary btn-sm"
                style={{ flexShrink: 0, alignSelf: "center" }}
                disabled={starting === interest_id}
                onClick={() => startNegotiation(interest_id)}
              >
                {starting === interest_id ? "Starting…" : "Start negotiation"}
              </button>
            ) : (
              <span style={{ color: "var(--text-muted)", fontSize: 18, alignSelf: "center" }}>›</span>
            )}
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
    </div>
  );
}
