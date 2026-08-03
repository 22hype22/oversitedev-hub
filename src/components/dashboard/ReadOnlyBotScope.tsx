import { ReactNode, createContext, useContext, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTeamRole, ROLE_LABEL } from "@/hooks/useTeamRole";

type Props = {
  /** The bot being viewed. Used to resolve per-bot team membership. */
  botId?: string | null;
  /** The user_id of the bot's actual owner. */
  ownerUserId?: string | null;
  /** When true, this bot was reached via a team membership (not ownership). */
  viaTeam?: boolean;
  children: ReactNode;
};

type BotScopeCtx = {
  botId: string | null;
  ownerUserId: string | null;
  viaTeam: boolean;
  readOnly: boolean;
};

const Ctx = createContext<BotScopeCtx>({
  botId: null,
  ownerUserId: null,
  viaTeam: false,
  readOnly: false,
});

/** Consume the surrounding bot scope (bot + owner + read-only flag). */
export function useBotScope() {
  return useContext(Ctx);
}

/**
 * Wraps a bot's dashboard content and locks all editing UI when the current
 * viewer is a team member without the `edit_bot_config` permission on this
 * specific bot. The lock is enforced visually via the `.readonly-scope` CSS
 * class. All write operations are *also* enforced server-side by RLS
 * policies (`has_bot_team_perm(... 'edit_bot_config')`).
 */
export function ReadOnlyBotScope({ botId, ownerUserId, viaTeam, children }: Props) {
  const { role, permissions, loading } = useTeamRole(viaTeam ? botId : null);

  // Owners (viaTeam=false) and team members with edit perms get full UI.
  const readOnly = !!viaTeam && !loading && !permissions.edit_bot_config;

  const ctxValue = useMemo<BotScopeCtx>(
    () => ({
      botId: botId ?? null,
      ownerUserId: ownerUserId ?? null,
      viaTeam: !!viaTeam,
      readOnly,
    }),
    [botId, ownerUserId, viaTeam, readOnly],
  );

  if (!readOnly) {
    return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
  }

  const roleLabel = role ? ROLE_LABEL[role] : "Team member";

  return (
    <Ctx.Provider value={ctxValue}>
      {/* Banner lives OUTSIDE the disabled fieldset so its button stays clickable. */}
      <ReadOnlyBanner botId={botId ?? null} roleLabel={roleLabel} />
      <fieldset
        disabled
        className="readonly-scope border-0 p-0 m-0 min-w-0 w-full"
        aria-readonly="true"
      >
        {children}
      </fieldset>
    </Ctx.Provider>
  );
}

/**
 * Slim gold-rail read-only banner. Sits full-width above the bot's config so it
 * lines up with the cards below it, and carries a real "Request Edit Access"
 * action that notifies the owner.
 */
function ReadOnlyBanner({ botId, roleLabel }: { botId: string | null; roleLabel: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const requestAccess = async () => {
    if (!botId || sending || sent) return;
    setSending(true);
    const { data, error } = await (supabase as any).rpc("team_request_edit_access", {
      _bot_id: botId,
    });
    setSending(false);
    if (error || (data && data.ok === false)) {
      toast.error("Couldn't send your request", {
        description: error?.message ?? (data as any)?.error ?? "Please try again.",
      });
      return;
    }
    setSent(true);
    toast.success("Request sent", {
      description: "The owner has been notified — they can grant access in Team → Roles.",
    });
  };

  return (
    <div className="w-full flex items-center gap-3 rounded-xl border border-[#cbb277]/25 border-l-[3px] border-l-[#cbb277] bg-[#2d353e] px-3.5 py-3 mb-3">
      <Lock className="h-4 w-4 text-[#cbb277] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[13px] text-[#E8EEF3]">Read-only</span>
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#cbb277] bg-[#cbb277]/10 border border-[#cbb277]/30 rounded px-1.5 py-0.5 leading-none">
            {roleLabel}
          </span>
        </div>
        <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
          View only — ask the owner for edit access in Team → Roles.
        </div>
      </div>
      <button
        type="button"
        onClick={requestAccess}
        disabled={sending || sent || !botId}
        className="shrink-0 text-[11.5px] font-medium text-[#E8EEF3] bg-white/5 border border-border rounded-lg px-3 py-1.5 transition hover:border-[#cbb277]/40 hover:text-[#cbb277] disabled:opacity-60 disabled:hover:border-border disabled:hover:text-[#E8EEF3]"
      >
        {sent ? "Requested ✓" : sending ? "Sending…" : "Request Edit Access"}
      </button>
    </div>
  );
}
