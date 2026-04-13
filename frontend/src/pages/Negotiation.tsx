import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";

interface NegotiationSummary {
  id: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  job: {
    id: number;
    position_type: { id: number; name: string };
    business: { id: number; business_name: string };
    salary_min: number;
    salary_max: number;
    start_time: string;
    end_time: string;
  };
  candidate: { id: number; first_name: string; last_name: string };
  decisions: { candidate: string | null; business: string | null };
}

interface NegotiationsResponse {
  count: number;
  results: NegotiationSummary[];
}

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(expiresAt: string) {
  const [ms, setMs] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );
  useEffect(() => {
    if (ms <= 0) return;
    const id = setInterval(() => {
      const r = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setMs(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return ms;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ── Small display components ──────────────────────────────────────────────────
function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const ms = useCountdown(expiresAt);
  const urgent = ms > 0 && ms < 120_000;
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: ms <= 0 ? "var(--text-muted)" : urgent ? "#dc2626" : "#16a34a",
      }}
    >
      {ms <= 0 ? "Expired" : `⏱ ${formatCountdown(ms)}`}
    </span>
  );
}

function DecisionChip({ val }: { val: string | null }) {
  if (val === "accept")
    return <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ Accepted</span>;
  if (val === "decline")
    return <span style={{ color: "#dc2626", fontWeight: 600 }}>✗ Declined</span>;
  return <span style={{ color: "var(--text-muted)" }}>Pending</span>;
}

// ── NegotiationCard ───────────────────────────────────────────────────────────
function NegotiationCard({
  neg,
  isBusiness,
  onClick,
}: {
  neg: NegotiationSummary;
  isBusiness: boolean;
  onClick: () => void;
}) {
  const isActive =
    neg.status === "active" &&
    new Date(neg.expiresAt).getTime() > Date.now();

  const otherParty = isBusiness
    ? `${neg.candidate.first_name} ${neg.candidate.last_name}`
    : neg.job.business.business_name;

  const otherPartyLabel = isBusiness ? "Candidate" : "Business";

  return (
    <div className="item-card" style={{ cursor: "pointer" }} onClick={onClick}>
      <div className="item-card-main">
        {/* Title row */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}
        >
          <span className="item-card-title">{neg.job.position_type.name}</span>
          <span className={`badge badge-${neg.status}`}>{neg.status}</span>
          {isActive && <CountdownBadge expiresAt={neg.expiresAt} />}
        </div>

        {/* Who with */}
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
          {otherPartyLabel}:{" "}
          <span style={{ color: "var(--text-muted)" }}>{otherParty}</span>
        </div>

        {/* Decisions */}
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <span>
            Business: <DecisionChip val={neg.decisions.business} />
          </span>
          <span>
            Candidate: <DecisionChip val={neg.decisions.candidate} />
          </span>
        </div>
      </div>
      <span
        style={{
          color: "var(--text-muted)",
          fontSize: 18,
          alignSelf: "center",
          flexShrink: 0,
        }}
      >
        ›
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NegotiationList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBusiness = user?.role === "business";

  const [negs, setNegs] = useState<NegotiationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  function load() {
    api
      .get<NegotiationsResponse>("/negotiations/me?limit=100")
      .then((r) => setNegs(r.results ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load negotiations")
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Connect socket to receive live negotiation:started events and refresh list
  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = io({ auth: { token } });
    socketRef.current = socket;
    socket.on("negotiation:started", () => load());
    return () => {
      socket.disconnect();
    };
  }, []);

  const now = Date.now();
  const active = negs.filter(
    (n) => n.status === "active" && new Date(n.expiresAt).getTime() > now
  );
  const past = negs.filter(
    (n) => n.status !== "active" || new Date(n.expiresAt).getTime() <= now
  );

  if (loading)
    return <p style={{ padding: 32, color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <div>
      <h1 className="page-title">Negotiations</h1>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {negs.length === 0 && (
        <div className="empty-state">No negotiations yet.</div>
      )}

      {active.length > 0 && (
        <>
          <h2
            style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}
          >
            Active · {active.length}
          </h2>
          <div className="item-list">
            {active.map((neg) => (
              <NegotiationCard
                key={neg.id}
                neg={neg}
                isBusiness={isBusiness}
                onClick={() => navigate(`/negotiation/${neg.id}`)}
              />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2
            style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}
          >
            Past
          </h2>
          <div className="item-list">
            {past.map((neg) => (
              <NegotiationCard
                key={neg.id}
                neg={neg}
                isBusiness={isBusiness}
                onClick={() => navigate(`/negotiation/${neg.id}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
