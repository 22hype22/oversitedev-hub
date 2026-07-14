import { useEffect, useState } from "react";
import { Loader2, ExternalLink, MessageSquare, Clock, Bot, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DISCORD_INVITE = "https://discord.gg/oversite";

type Phase =
  | { kind: "join" }
  | { kind: "in_stock" }
  | { kind: "waitlist"; botsNeeded: number };

/**
 * Post-payment gate shown on /checkout/return for bot orders.
 *
 *  1. Asks the customer to join the Discord server (mandatory).
 *  2. On "I've joined", calls confirm-order-discord-join which decides
 *     server-side whether the order takes the in-stock path (status -> ready,
 *     auto-deploy fires) or the waitlist path (status -> waitlisted, customer
 *     gets a "still want to proceed?" DM the moment a slot opens up).
 *
 * Styled with the OSSYS slate palette (CSS vars inherited from the .ossys
 * page shell) — deliberately no shadcn theme colors here so the card matches
 * the system page instead of the default blue component theme.
 */

const card: React.CSSProperties = {
  marginBottom: 24,
  borderRadius: 14,
  border: "1px solid var(--os-hair)",
  background: "rgba(232,238,243,.045)",
  padding: "18px 20px",
  textAlign: "left",
};

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  padding: "8px 18px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  cursor: "pointer",
  transition: "filter .15s, background .15s",
  border: "1px solid transparent",
};

export const DiscordJoinGate = ({ orderId }: { orderId: string }) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: "join" });
  const [busy, setBusy] = useState(false);
  // Once the order is confirmed the journey continues in the dashboard, so
  // count down and take the customer there instead of dead-ending the page.
  const [secondsLeft, setSecondsLeft] = useState(6);
  useEffect(() => {
    if (phase.kind !== "in_stock") return;
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const go = setTimeout(() => navigate("/bot-dashboard"), 6000);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [phase.kind, navigate]);

  const onJoinConfirmed = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "confirm-order-discord-join",
        { body: { orderId } },
      );
      if (error || !data?.ok) {
        toast.error(error?.message || data?.error || "Couldn't confirm — please try again.");
        return;
      }
      if (data.path === "in_stock" || data.alreadyHandled) {
        setPhase({ kind: "in_stock" });
      } else {
        setPhase({ kind: "waitlist", botsNeeded: data.botsNeeded ?? 1 });
      }
    } finally {
      setBusy(false);
    }
  };

  if (phase.kind === "join") {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <MessageSquare size={18} style={{ color: "var(--os-accent)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--os-heading)", margin: 0 }}>
              One more step — join our Discord
            </p>
            <p style={{ fontSize: 12, color: "var(--os-body)", margin: "6px 0 0", lineHeight: 1.55 }}>
              Join the Oversite Discord server so we can DM you build progress, deployment
              notifications, and (if needed) confirm your order details.
            </p>
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...pillBase,
                  border: "1px solid var(--os-hair)",
                  color: "var(--os-heading)",
                  background: "rgba(232,238,243,.05)",
                  textDecoration: "none",
                }}
              >
                Open Discord <ExternalLink size={13} />
              </a>
              <button
                type="button"
                onClick={onJoinConfirmed}
                disabled={busy}
                style={{
                  ...pillBase,
                  background: "var(--os-accent)",
                  color: "var(--os-accent-ink)",
                  opacity: busy ? 0.6 : 1,
                  pointerEvents: busy ? "none" : "auto",
                }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : "I've joined"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === "in_stock") {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Bot size={18} style={{ color: "#86d3a1", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--os-heading)", margin: 0 }}>
              Your bot is being built!
            </p>
            <p style={{ fontSize: 12, color: "var(--os-body)", margin: "6px 0 0", lineHeight: 1.55 }}>
              A bot slot has been reserved and your build has been queued. You'll get a
              Discord DM the moment it's live. This usually takes less than a minute.
            </p>
            <p style={{ fontSize: 11, color: "var(--os-faint)", margin: "8px 0 0" }}>
              Taking you to your dashboard in {secondsLeft}s…
            </p>
            <button
              type="button"
              onClick={() => navigate("/bot-dashboard")}
              style={{
                ...pillBase,
                marginTop: 14,
                background: "var(--os-accent)",
                color: "var(--os-accent-ink)",
              }}
            >
              Go to my dashboard <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // waitlist
  return (
    <div style={{ ...card, border: "1px solid rgba(245,196,110,.35)", background: "rgba(245,196,110,.06)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Clock size={18} style={{ color: "#f5c46e", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--os-heading)", margin: 0 }}>
            You're on the waitlist
            {phase.botsNeeded > 1 ? ` (${phase.botsNeeded} bots)` : ""}
          </p>
          <p style={{ fontSize: 12, color: "var(--os-body)", margin: "6px 0 0", lineHeight: 1.55 }}>
            All bot slots are currently allocated. The moment one opens up, we'll DM you on
            Discord asking if you'd like us to deploy — just reply <strong>YES</strong> and
            your bot goes live.
          </p>
            <button
              type="button"
              onClick={() => navigate("/bot-dashboard")}
              style={{
                ...pillBase,
                marginTop: 14,
                background: "var(--os-accent)",
                color: "var(--os-accent-ink)",
              }}
            >
              Go to my dashboard <ArrowRight size={13} />
            </button>
        </div>
      </div>
    </div>
  );
};
