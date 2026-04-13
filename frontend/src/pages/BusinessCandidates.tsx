import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

interface Job {
  id: number; status: string;
  worker: { id: number; first_name: string; last_name: string } | null;
  position_type: { id: number; name: string };
  salary_min: number; salary_max: number;
  start_time: string; end_time: string;
}

interface CandidateEntry {
  id: number;
  first_name: string;
  last_name: string;
  businessInterested: boolean;
  candidateInterested: boolean;
  interest_id?: number;
}

interface CandidatesResponse {
  count: number;
  results: { id: number; first_name: string; last_name: string; invited: boolean }[];
}
interface InterestsResponse {
  count: number;
  results: { interest_id: number; mutual: boolean; user: { id: number; first_name: string; last_name: string } }[];
}

export default function BusinessCandidates() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<CandidateEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [starting, setStarting] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Job>(`/jobs/${id}`),
      api.get<CandidatesResponse>(`/jobs/${id}/candidates?limit=100`),
      api.get<InterestsResponse>(`/jobs/${id}/interests?limit=100`),
    ])
      .then(([jobData, candidatesData, interestsData]) => {
        setJob(jobData);

        // Build a merged map by user id
        const map = new Map<number, CandidateEntry>();

        for (const c of candidatesData.results)
        {
          map.set(c.id, {
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            businessInterested: c.invited,
            candidateInterested: false,
          });
        }

        for (const i of interestsData.results)
        {
          const u = i.user;
          if (map.has(u.id))
          {
            map.get(u.id)!.candidateInterested = true;
            if (i.mutual) {
              map.get(u.id)!.businessInterested = true;
              map.get(u.id)!.interest_id = i.interest_id;
            }
          } else
          {
            map.set(u.id, {
              id: u.id,
              first_name: u.first_name,
              last_name: u.last_name,
              businessInterested: i.mutual,
              candidateInterested: true,
              interest_id: i.mutual ? i.interest_id : undefined,
            });
          }
        }

        setCandidates(Array.from(map.values()));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load candidates"))
      .finally(() => setLoading(false));
  }, [id]);

  async function startNegotiation(interest_id: number) {
    setStarting(interest_id);
    setError(null);
    try
    {
      const neg = await api.post<{ id: number }>("/negotiations", { interest_id });
      navigate(`/negotiation/${neg.id}`);
    } catch (err)
    {
      setError(err instanceof Error ? err.message : "Failed to start negotiation");
    } finally
    {
      setStarting(null);
    }
  }

  async function setInterest(userId: number, interested: boolean) {
    setActing(userId);
    setError(null);
    try
    {
      const res = await api.patch<{ id: number }>(`/jobs/${id}/candidates/${userId}/interested`, { interested });
      setCandidates((prev) =>
        prev.map((c) => c.id === userId ? { ...c, businessInterested: interested, interest_id: interested ? res.id : c.interest_id } : c)
      );
    } catch (err)
    {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally
    {
      setActing(null);
    }
  }

  async function markNoShow() {
    if (!job) return;
    setMarking(true);
    setError(null);
    try
    {
      const updated = await api.patch<{ id: number; status: string }>(`/jobs/${job.id}/no-show`, {});
      setJob((prev) => prev ? { ...prev, status: updated.status } : prev);
    } catch (err)
    {
      setError(err instanceof Error ? err.message : "Failed to mark no-show");
    } finally
    {
      setMarking(false);
    }
  }

  const now = Date.now();
  const canMarkNoShow = job?.status === "filled"
    && new Date(job.start_time).getTime() <= now
    && new Date(job.end_time).getTime() > now;

  function getState(c: CandidateEntry): "hired" | "mutual" | "invited" | "interested" | "none" {
    if (job?.worker?.id === c.id) return "hired";
    if (c.businessInterested && c.candidateInterested) return "mutual";
    if (c.businessInterested) return "invited";
    if (c.candidateInterested) return "interested";
    return "none";
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate("/business/jobs")}>← Back to jobs</button>
      <h1 className="page-title">Candidates</h1>
      {job && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
            {job.position_type.name} · <span className={`badge badge-${job.status}`}>{job.status}</span> · {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </p>
          {canMarkNoShow && (
            <button className="btn btn-danger btn-sm" disabled={marking} onClick={markNoShow}>
              {marking ? "Marking…" : "Mark No-Show"}
            </button>
          )}
        </div>
      )}

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!loading && candidates.length === 0 && (
        <div className="empty-state">{job?.status === "filled" ? "This job is filled." : "No candidates found for this job."}</div>
      )}

      <div className="item-list">
        {candidates.map((c) => {
          const state = getState(c);
          const busy = acting === c.id;

          return (
            <div key={c.id} className="item-card">
              <div className="item-card-main">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span className="item-card-title">{c.first_name} {c.last_name}</span>
                  {state === "hired" && <span className="badge badge-filled">Hired</span>}
                  {state === "mutual" && <span className="badge badge-approved">Mutual interest</span>}
                  {state === "interested" && <span className="badge badge-submitted">Wants job</span>}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/business/jobs/${id}/candidates/${c.id}`)}>
                  Details
                </button>
                {state === "hired" && (
                  <span className="btn btn-ghost btn-sm" style={{ pointerEvents: "none", opacity: 0.6 }}>Hired</span>
                )}
                {state === "mutual" && (
                  <>
                    <button className="btn btn-primary btn-sm" disabled={starting === c.interest_id}
                      onClick={() => c.interest_id != null && startNegotiation(c.interest_id)}>
                      {starting === c.interest_id ? "Starting…" : "Start negotiation"}
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy}
                      onClick={() => setInterest(c.id, false)}>
                      {busy ? "…" : "Withdraw invite"}
                    </button>
                  </>
                )}
                {state === "invited" && (
                  <button className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => setInterest(c.id, false)}>
                    {busy ? "…" : "Withdraw invite"}
                  </button>
                )}
                {(state === "none" || state === "interested") && (
                  <button className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => setInterest(c.id, true)}>
                    {busy ? "…" : "Invite"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
