import { Bot, Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { OwnedBot } from "@/hooks/useOwnedBots";

type Props = {
  bot: OwnedBot;
  onUpdated: () => void;
  /** Status / category badges rendered under the name. */
  badges?: React.ReactNode;
  /** Action buttons rendered on the right side of the header row. */
  actions?: React.ReactNode;
};

export const BotIdentityEditor = ({ bot, badges, actions }: Props) => {
  return (
    <Card className="overflow-hidden bg-card/60 border-border">
      {/* Banner */}
      <div className="relative h-36 sm:h-44 w-full bg-gradient-to-br from-primary/20 via-primary/5 to-background border-b border-border">
        {bot.banner_url ? (
          <img
            src={bot.banner_url}
            alt={`${bot.bot_name} banner`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <div className="flex items-center gap-2 text-xs">
              <ImageIcon className="h-4 w-4" />
              No banner uploaded
            </div>
          </div>
        )}
      </div>

      {/* Icon + name row */}
      <div className="px-5 pb-5 -mt-10 flex items-end gap-4 flex-wrap">
        <div className="relative shrink-0">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 border-4 border-card grid place-items-center overflow-hidden shadow-md">
            {bot.icon_url ? (
              <img src={bot.icon_url} alt={bot.bot_name} className="h-full w-full object-cover" />
            ) : (
              <Bot className="h-8 w-8 text-primary" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 pt-10 flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-2xl font-bold tracking-tight truncate">{bot.bot_name}</h2>
            </div>
            {badges && (
              <div className="flex flex-wrap items-center gap-2 mt-2">{badges}</div>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      </div>
    </Card>
  );
};
