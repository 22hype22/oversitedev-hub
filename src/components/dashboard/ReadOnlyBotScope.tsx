import { ReactNode } from "react";
import { Eye, Lock } from "lucide-react";
import { useTeamRole, ROLE_LABEL } from "@/hooks/useTeamRole";

type Props = {
  /** The user_id of the bot's actual owner. */
  ownerUserId?: string | null;
  /** When true, this bot was reached via a team membership (not ownership). */
  viaTeam?: boolean;
  children: ReactNode;
};

/**
 * Wraps a bot's dashboard content and locks all editing UI when the current
 * viewer is a team member without the `edit_bot_config` permission. The
 * lock is enforced visually via the `.readonly-scope` CSS class (see
 * `src/index.css`). All write operations are *also* enforced server-side
 * by RLS policies (`has_team_perm(... 'edit_bot_config')`) so the gate
 * cannot be bypassed by calling the API directly.
 */
export function ReadOnlyBotScope({ ownerUserId, viaTeam, children }: Props) {
  const { role, permissions, loading } = useTeamRole(viaTeam ? ownerUserId : null);

  // Owners (viaTeam=false) and team members with edit perms get full UI.
  const readOnly = !!viaTeam && !loading && !permissions.edit_bot_config;

  if (!readOnly) return <>{children}</>;

  const roleLabel = role ? ROLE_LABEL[role] : "Team member";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
        <div className="h-8 w-8 rounded-md bg-amber-500/10 border border-amber-500/30 grid place-items-center shrink-0">
          <Eye className="h-4 w-4 text-amber-400" />
        </div>
        <div className="text-sm">
          <div className="font-semibold text-amber-300 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Read-only access · {roleLabel}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your role can view this bot but not change its settings. Inputs,
            toggles, and save actions are disabled. Ask the owner to grant
            edit permissions in the Roles tab to unlock changes.
          </p>
        </div>
      </div>
      <div className="readonly-scope" aria-readonly="true">
        {children}
      </div>
    </div>
  );
}
