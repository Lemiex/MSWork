import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";
import { formatCountdown } from "./Negotiation";

interface Negotiation {
  id: number;
  status: string;
  expiresAt: string;
  createdAt: string;
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
  candidate: { id: number; first_name: string; last_name: string };
  decisions: { candidate: string | null; business: string | null };
}

interface DecisionPatch {
  id: number;
  status: string;
  expiresAt: string;
  decisions: { candidate: string | null; business: string | null };
}

interface ChatMessage {
  negotiation_id: number;
  sender: { role: string; id: number };
  text: string;
  createdAt: string;
}

// ── Countdown hook ─────────────────────────────────────────────────────────────
function useCountdown(expiresAt: string) {
  const [ms, setMs] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );
  useEffect(() => {
    setMs(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
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

// ── Decision display ───────────────────────────────────────────────────────────
function DecisionChip({ val, label }: { val: string | null; label: string }) {
  let colour = "var(--text-muted)";
  let text = "Pending";
  if (val === "accept") { colour = "#16a34a"; text = "Accepted ✓"; }
  if (val === "decline") { colour = "#dc2626"; text = "Declined ✗"; }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{ fontWeight: 600, color: colour }}>{text}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NegotiationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBusiness = user?.role === "business";

  const [neg, setNeg] = useState<Negotiation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [deciding, setDeciding] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const negId = parseInt(id ?? "", 10);

  // ── Load negotiation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    api
      .get<Negotiation>(`/negotiations/${negId}`)
      .then(setNeg)
      .catch((err) => {
        if (err?.status === 404) setNotFound(true);
        else setError(err instanceof Error ? err.message : "Failed to load negotiation");
      });
  }, [id]);

  // ── Socket — only needed for active negotiations ────────────────────────────
  useEffect(() => {
    if (!neg || neg.status !== "active") return;
    const token = localStorage.getItem("token");
    const socket = io(import.meta.env.VITE_API_URL ?? "", { auth: { token } });
    socketRef.current = socket;

    socket.on("negotiation:history", (data: { negotiation_id: number; messages: ChatMessage[] }) => {
      if (data.negotiation_id === neg.id) setMessages(data.messages);
    });

    socket.on("negotiation:message", (msg: ChatMessage) => {
      if (msg.negotiation_id === neg.id)
        setMessages((prev) => [...prev, msg]);
    });

    socket.on("negotiation:error", (data: { error: string }) =>
      setError(data.error)
    );

    // When a new negotiation starts elsewhere, no action needed here
    return () => {
      socket.disconnect();
    };
  }, [neg?.id]);

  // Auto-scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Countdown ───────────────────────────────────────────────────────────────
  const remainingMs = useCountdown(neg?.expiresAt ?? new Date(0).toISOString());
  const isActive = neg?.status === "active" && remainingMs > 0;
  const expired = neg?.status === "active" && remainingMs <= 0;

  // ── Conflicting-action guard ─────────────────────────────────────────────────
  // Warn the user if they try to navigate away during an active negotiation
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isActive]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  function sendMessage() {
    if (!text.trim() || !neg || !socketRef.current) return;
    socketRef.current.emit("negotiation:message", {
      negotiation_id: neg.id,
      text: text.trim(),
    });
    setText("");
  }

  async function decide(decision: "accept" | "decline") {
    if (!neg) return;
    if (
      decision === "decline" &&
      !window.confirm("Are you sure you want to decline this negotiation?")
    )
      return;
    setDeciding(true);
    setError(null);
    try {
      const patch = await api.patch<DecisionPatch>("/negotiations/me/decision", {
        decision,
        negotiation_id: neg.id,
      });
      setNeg((prev) =>
        prev
          ? { ...prev, status: patch.status, expiresAt: patch.expiresAt, decisions: patch.decisions }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit decision");
    } finally {
      setDeciding(false);
    }
  }

  // ── My current decision ─────────────────────────────────────────────────────
  const myDecision = neg
    ? isBusiness
      ? neg.decisions.business
      : neg.decisions.candidate
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  if (notFound)
    return (
      <div>
        <button className="back-link" onClick={() => navigate("/negotiation")}>
          ← Back to negotiations
        </button>
        <p className="alert alert-error">Negotiation not found.</p>
      </div>
    );

  if (error && !neg)
    return (
      <div>
        <button className="back-link" onClick={() => navigate("/negotiation")}>
          ← Back to negotiations
        </button>
        <p className="alert alert-error" role="alert">{error}</p>
      </div>
    );

  if (!neg)
    return <p style={{ padding: 32, color: "var(--text-muted)" }}>Loading…</p>;

  const otherParty = isBusiness
    ? `${neg.candidate.first_name} ${neg.candidate.last_name}`
    : neg.job.business.business_name;
  const otherPartyLabel = isBusiness ? "Candidate" : "Business";

  return (
    <div>
      <button className="back-link" onClick={() => navigate("/negotiation")}>
        ← Back to negotiations
      </button>

      {/* Active negotiation banner — warns about conflicting actions */}
      {isActive && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 16,
            fontSize: 14,
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ⚠️ You have an active negotiation in progress. Accepting or declining
          cannot be undone.
        </div>
      )}

      {/* Info card */}
      <div className="card" style={{ marginBottom: 16 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
              {neg.job.position_type.name}
            </h1>
            <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
              {neg.job.business.business_name}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span className={`badge badge-${neg.status}`}>{neg.status}</span>
            {neg.status === "active" && (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: remainingMs <= 0 ? "var(--text-muted)" : remainingMs < 120_000 ? "#dc2626" : "#16a34a",
                }}
              >
                {remainingMs > 0 ? `⏱ ${formatCountdown(remainingMs)}` : "Expired"}
              </span>
            )}
          </div>
        </div>

        {/* Who with */}
        <div className="detail-grid" style={{ marginBottom: 16 }}>
          <div className="detail-field">
            <label>{otherPartyLabel}</label>
            <p style={{ fontWeight: 600 }}>{otherParty}</p>
          </div>
          <div className="detail-field">
            <label>Salary</label>
            <p>${neg.job.salary_min}–${neg.job.salary_max}/hr</p>
          </div>
          <div className="detail-field">
            <label>Shift start</label>
            <p>{new Date(neg.job.start_time).toLocaleString()}</p>
          </div>
          <div className="detail-field">
            <label>Expires</label>
            <p>{new Date(neg.expiresAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Decisions panel */}
        <div
          style={{
            display: "flex",
            gap: 32,
            padding: "12px 16px",
            background: "var(--surface-2, #f8f9fa)",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <DecisionChip val={neg.decisions.business} label="Business decision" />
          <DecisionChip val={neg.decisions.candidate} label="Candidate decision" />
        </div>

        {/* Result banner for completed negotiations */}
        {neg.status === "success" && (
          <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "10px 16px", fontSize: 14, color: "#166534", marginBottom: 16 }}>
            ✓ Both sides accepted — job is filled.
          </div>
        )}
        {neg.status === "failed" && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 16px", fontSize: 14, color: "#991b1b", marginBottom: 16 }}>
            ✗ Negotiation ended — one side declined.
          </div>
        )}
        {expired && (
          <div style={{ background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 16px", fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            This negotiation window has expired.
          </div>
        )}

        {error && (
          <p className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </p>
        )}

        {/* Accept / Decline — only when active and user hasn't decided yet */}
        {isActive && myDecision === null && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={() => decide("accept")}
              disabled={deciding}
            >
              {deciding ? "Submitting…" : "Accept"}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => decide("decline")}
              disabled={deciding}
            >
              {deciding ? "Submitting…" : "Decline"}
            </button>
          </div>
        )}
        {isActive && myDecision !== null && (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            You have already submitted your decision. Waiting for the other party.
          </p>
        )}
      </div>

      {/* Chat — only shown for active negotiations */}
      {isActive && (
        <div className="card">
          <p className="card-title">Chat</p>
          <div className="chat-box">
            {messages.length === 0 && (
              <span className="chat-empty">No messages yet. Say hello!</span>
            )}
            {messages.map((m, i) => {
              const mine = m.sender.id === user?.id;
              return (
                <div key={i} className={`chat-msg ${mine ? "mine" : "theirs"}`}>
                  {!mine && (
                    <div
                      style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}
                    >
                      {otherParty}
                    </div>
                  )}
                  <div>{m.text}</div>
                  <div className="chat-msg-meta">
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input
              type="text"
              value={text}
              placeholder="Type a message…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button className="btn btn-primary" onClick={sendMessage}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
