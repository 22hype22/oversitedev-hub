import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Popup callback for the "Link Discord" flow started from the bot builder.
// Discord redirects here with ?code=&state=. We exchange the code, tell the
// window that opened us the result, then close. Kept as its own tiny route so
// the heavy bot builder never has to render inside the popup.
const STATE_KEY = "oswire_discord_link_state";
export const DISCORD_LINK_MSG = "oswire-discord-linked";

export default function DiscordLinkedPopup() {
  const [msg, setMsg] = useState("Linking your Discord…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    const expected = localStorage.getItem(STATE_KEY);
    localStorage.removeItem(STATE_KEY);

    const finish = (payload: Record<string, unknown>) => {
      try {
        window.opener?.postMessage(
          { type: DISCORD_LINK_MSG, ...payload },
          window.location.origin,
        );
      } catch {
        /* opener gone — nothing to do */
      }
      // Give the message a tick to deliver before closing.
      setTimeout(() => window.close(), 200);
    };

    if (!code) {
      setMsg("Discord link cancelled — you can close this window.");
      finish({ ok: false, error: "cancelled" });
      return;
    }
    if (!expected || expected !== returnedState) {
      setMsg("This link expired — please try again.");
      finish({ ok: false, error: "state_mismatch" });
      return;
    }

    (async () => {
      const redirect_uri = `${window.location.origin}/discord/linked`;
      const { data, error } = await supabase.functions.invoke("discord-link", {
        body: { action: "exchange_code", code, redirect_uri },
      });
      if (error || !data?.ok) {
        setMsg("Couldn't link Discord — you can close this window.");
        finish({ ok: false, error: data?.error || error?.message || "exchange_failed" });
        return;
      }
      setMsg(`Linked @${data.discord_username || data.discord_user_id}! Closing…`);
      finish({
        ok: true,
        discord_user_id: data.discord_user_id,
        discord_username: data.discord_username,
      });
    })();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0b0f",
        color: "#e6e6ee",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 15, maxWidth: 360, lineHeight: 1.5 }}>{msg}</p>
    </div>
  );
}
