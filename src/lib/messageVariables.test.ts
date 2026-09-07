import { describe, it, expect } from "vitest";
import { BASE_INCLUDED_ADDONS } from "@/lib/botCatalog";
import { SCOPED_BLOCKS, countVariables, variablesFor } from "@/lib/messageVariables";

// Every block a dashboard can show must answer with at least one variable
// group, so no message design ever ships without a Variables button.
describe("message variables", () => {
  const everyBlock = Array.from(new Set(Object.values(BASE_INCLUDED_ADDONS).flat()));

  it("gives every block at least the server-wide variables", () => {
    for (const id of everyBlock) {
      expect(countVariables(variablesFor(id)), `no variables for ${id}`).toBeGreaterThan(0);
    }
  });

  it("gives every scoped design its own list", () => {
    for (const [id, keys] of Object.entries(SCOPED_BLOCKS)) {
      for (const key of keys) {
        expect(countVariables(variablesFor(id, key)), `no variables for ${id} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("never lists the same token twice in one panel", () => {
    const check = (id: string, key?: string) => {
      const seen = new Set<string>();
      for (const g of variablesFor(id, key)) {
        for (const v of g.vars) {
          expect(seen.has(v.token), `${v.token} twice in ${id} ${key ?? ""}`).toBe(false);
          seen.add(v.token);
        }
      }
    };
    for (const id of everyBlock) check(id);
    for (const [id, keys] of Object.entries(SCOPED_BLOCKS)) for (const key of keys) check(id, key);
  });

  it("wraps every token in braces", () => {
    for (const id of everyBlock) {
      for (const g of variablesFor(id)) {
        for (const v of g.vars) expect(v.token).toMatch(/^\{.+\}$/);
      }
    }
  });
});
