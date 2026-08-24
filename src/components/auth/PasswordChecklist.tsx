import { Check, X } from "lucide-react";
import { checkPassword } from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

/**
 * Live password-requirements checklist. Each rule shows a green check when met
 * and a red x with the reason when not, so the user sees exactly what's missing
 * as they type (rather than a generic error after submit).
 */
export function PasswordChecklist({ password, className }: { password: string; className?: string }) {
  const rules = checkPassword(password);
  return (
    <ul className={cn("mt-2 space-y-1.5", className)} aria-label="Password requirements">
      {rules.map((r) => (
        <li key={r.key} className="flex items-center gap-2 font-body text-[12.5px]">
          <span
            className={cn(
              "grid h-4 w-4 shrink-0 place-items-center rounded-full",
              r.ok ? "bg-os-good/15 text-os-good" : "bg-os-bad/15 text-os-bad",
            )}
            aria-hidden
          >
            {r.ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span className={r.ok ? "text-os-good" : "text-os-bad"}>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
