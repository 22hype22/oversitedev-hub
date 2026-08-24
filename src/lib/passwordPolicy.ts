// Single source of truth for the account-password rules. Used by the sign-up
// form, the password-reset step, and anywhere else a new password is set, so the
// requirements shown to the user and the ones enforced on submit never drift.

export interface PasswordRule {
  key: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: "length", label: "8 characters", test: (p) => p.length >= 8 },
  { key: "special", label: "At least 1 special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
  { key: "upper", label: "At least 1 upper case", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "At least 1 number", test: (p) => /[0-9]/.test(p) },
];

export interface RuleState extends PasswordRule {
  ok: boolean;
}

/** Every rule paired with whether the given password satisfies it. */
export function checkPassword(pw: string): RuleState[] {
  return PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(pw) }));
}

/** True only when the password satisfies every rule. */
export function passwordMeetsPolicy(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

/** The label of the first unmet rule (for a concise inline error), or null. */
export function firstUnmetRule(pw: string): string | null {
  return PASSWORD_RULES.find((r) => !r.test(pw))?.label ?? null;
}
