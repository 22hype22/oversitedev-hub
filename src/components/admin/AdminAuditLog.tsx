import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AuditRow {
  id: string;
  admin_user_id: string;
  target_user_id: string | null;
  target_bot_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function AdminAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error) setRows((data ?? []) as AuditRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <ShieldAlert size={16} /> Admin audit log
        </h2>
        <p className="text-sm text-muted-foreground">
          Last 200 sensitive admin actions.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No actions logged yet.</p>
      ) : (
        <div className="rounded-lg border max-h-96 overflow-y-auto">
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {r.action}
                  </Badge>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="font-mono text-muted-foreground mt-1 break-all">
                  admin: {r.admin_user_id.slice(0, 8)}…
                  {r.target_user_id && ` · target: ${r.target_user_id.slice(0, 8)}…`}
                  {r.target_bot_id && ` · bot: ${r.target_bot_id.slice(0, 8)}…`}
                </div>
                {r.details && (
                  <pre className="text-[10px] mt-1 bg-muted/40 p-2 rounded overflow-x-auto">
                    {JSON.stringify(r.details, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
