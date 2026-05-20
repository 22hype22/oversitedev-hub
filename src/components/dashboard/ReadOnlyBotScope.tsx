import { ReactNode, createContext, useContext, useMemo } from "react";
import { Eye, Lock } from "lucide-react";
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
      <fieldset
        disabled
        className="readonly-scope border-0 p-0 m-0 min-w-0 w-full"
        aria-readonly="true"
      >
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3 mb-3">
          <div className="h-8 w-8 rounded-md bg-amber-500/10 border border-amber-500/30 grid place-items-center shrink-0">
            <Eye className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-sm">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Read-only access · {roleLabel}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your role on this bot can view it but not change its settings.
              Inputs, toggles, and save actions are disabled. Ask the owner to
              grant edit permissions in the Team tab to unlock changes.
            </p>
          </div>
        </div>
        {children}
      </fieldset>
    </Ctx.Provider>
  );
}
