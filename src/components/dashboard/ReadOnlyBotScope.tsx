import { ReactNode, createContext, useContext, useMemo } from "react";
import { useTeamRole } from "@/hooks/useTeamRole";

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
 * specific bot.
 *
 * Note: My Bots is now nav-gated on `edit_bot_config`, so a member who can even
 * reach a bot's page already has edit rights — this read-only branch is a
 * server-parity safety net (RLS still enforces `has_bot_team_perm`), not a
 * user-facing state. It disables inputs silently; there is intentionally no
 * banner (removed by request — access is communicated by which sections a role
 * can open, not an inline notice).
 */
export function ReadOnlyBotScope({ botId, ownerUserId, viaTeam, children }: Props) {
  const { permissions, loading } = useTeamRole(viaTeam ? botId : null);

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

  return (
    <Ctx.Provider value={ctxValue}>
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
