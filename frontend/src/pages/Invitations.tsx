import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Pagination from "../components/Pagination";

interface Invitation {
  id: number;
  status: string;
  position_type: { id: number; name: string };
  business: { id: number; business_name: string };
  salary_min: number;
  salary_max: number;
  start_time: string;
  end_time: string;
}
interface InvitationsResponse { count: number; results: Invitation[]; }

const LIMIT = 10;

export default function Invitations() {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    api.get<InvitationsResponse>(`/users/me/invitations?page=${page}&limit=${LIMIT}`)
      .then((r) => { setInvitations(r.results); setTotal(r.count); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load invitations"));
  }, [page]);

  return (
    <div>
      <h1 className="page-title">My Invitations</h1>
      <p className="page-subtitle">Jobs where a business has expressed interest in you.</p>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {invitations.length === 0 && <div className="empty-state">No invitations yet.</div>}

      <div className="item-list">
        {invitations.map((inv) => (
          <button key={inv.id} className="item-card" onClick={() => navigate(`/jobs/${inv.id}`)}>
            <div className="item-card-main">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="item-card-title">{inv.position_type.name}</span>
                <span className="badge badge-open">invited</span>
              </div>
              <div style={{ fontWeight: 500, fontSize: 14, color: "var(--text-muted)", marginBottom: 2 }}>
                {inv.business.business_name}
              </div>
              <div className="item-card-sub">
                <span>${inv.salary_min}–${inv.salary_max}/hr</span>
                <span>·</span>
                <span>{new Date(inv.start_time).toLocaleDateString()}</span>
              </div>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: 18, alignSelf: "center" }}>›</span>
          </button>
        ))}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
    </div>
  );
}
