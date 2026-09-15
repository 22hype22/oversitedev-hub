/**
 * Parts the bot needs in a message (the Verify button, the session menu, the
 * giveaway's Enter button) are kept in the design: they can be reworded and
 * moved, they show a lock where the delete control would be, and they come
 * back when a design without them is loaded.
 */
import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MessagesV2Builder, type MessagesV2BuilderHandle, type V2Item } from "./MessagesV2Builder";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/hooks/useGuildChannels", () => ({ useBotChannels: () => ({ channels: [] }) }));
vi.mock("@/hooks/useActiveGuild", () => ({ useActiveGuild: () => ({ guild: null, setGuild: () => {} }) }));
vi.mock("./VariablesPanel", () => ({ VariablesFallbackButton: () => null }));
vi.mock("./GuildChannelPicker", () => ({ GuildChannelPicker: () => null }));

const LOCK = "Added by the bot. Edit it or move it; it cannot be removed.";

const text = (t: string): V2Item => ({ id: `t-${t}`, type: "text", text: t });
const verifyRow = (): V2Item =>
  ({ id: "fixed-verify", type: "buttonRow", buttons: [{ id: "fixed-verify-btn", label: "Verify", __verify: true, style: "primary" }] } as unknown as V2Item);
const menu = (): V2Item =>
  ({ id: "fixed-menu", type: "select_menu", __session_menu: true, placeholder: "What do you want to do?", options: [
    { label: "Start a session vote", description: "Post a vote", display: true },
    { label: "Start the session", description: "", display: true },
    { label: "Boost the session", description: "", display: true },
    { label: "End the session", description: "", display: true },
  ] } as unknown as V2Item);

/** Every button anywhere in the (normalised) design. */
const buttons = (items: V2Item[]): any[] =>
  items.flatMap((it: any) => it.type === "container" ? buttons(it.children) : it.type === "buttonRow" ? it.buttons : []);
const leafTypes = (items: V2Item[]): string[] =>
  items.flatMap((it: any) => it.type === "container" ? it.children.map((c: any) => c.type) : [it.type]);

function mount(props: Partial<React.ComponentProps<typeof MessagesV2Builder>>) {
  const ref = createRef<MessagesV2BuilderHandle>();
  const utils = render(<MessagesV2Builder ref={ref} embedded botName="Bot" hidePreview {...props} />);
  return { ref, ...utils };
}

describe("a design's fixed parts", () => {
  it("shows the Verify button in the stack with a lock and no delete control", () => {
    mount({ initialItems: [text("Welcome")], lockedItems: [verifyRow()] });
    const locks = screen.getAllByTitle(LOCK);
    expect(locks.length).toBeGreaterThanOrEqual(1);
    const block = screen.getByText("added by the bot").closest(".rounded-lg") as HTMLElement;
    expect(block).not.toBeNull();
    // Move controls are there, the delete control is not.
    expect(within(block).getAllByRole("button").some((b) => b.querySelector("svg.lucide-chevron-up"))).toBe(true);
    expect(block.querySelector('svg[class*="trash"]')).toBeNull();
    // The text block above it still has one, so the selector is not vacuous.
    expect(document.querySelector('svg[class*="trash"]')).not.toBeNull();
    expect(within(block).getAllByTitle(LOCK).length).toBeGreaterThanOrEqual(1);
  });

  it("lets the Verify button be renamed and is saved with the design", () => {
    const { ref } = mount({ initialItems: [text("Welcome")], lockedItems: [verifyRow()] });
    const label = screen.getByDisplayValue("Verify");
    fireEvent.change(label, { target: { value: "Link your Roblox" } });
    const saved = buttons(ref.current!.getItems());
    expect(saved).toHaveLength(1);
    expect(saved[0].__verify).toBe(true);
    expect(saved[0].label).toBe("Link your Roblox");
  });

  it("lets the Verify button be moved above the text", () => {
    const { ref } = mount({ initialItems: [text("Welcome")], lockedItems: [verifyRow()] });
    expect(leafTypes(ref.current!.getItems())).toEqual(["text", "buttonRow"]);
    const block = screen.getByText("added by the bot").closest(".rounded-lg") as HTMLElement;
    const up = within(block).getAllByRole("button").find((b) => b.querySelector("svg.lucide-chevron-up"))!;
    fireEvent.click(up);
    expect(leafTypes(ref.current!.getItems())).toEqual(["buttonRow", "text"]);
  });

  it("puts the Verify button back when a template without one is loaded", () => {
    const { ref } = mount({ initialItems: [text("Welcome")], lockedItems: [verifyRow()] });
    ref.current!.setItems([text("Fresh start")]);
    const saved = buttons(ref.current!.getItems());
    expect(saved.map((b) => b.__verify)).toEqual([true]);
  });

  it("does not add a second Verify button to a design that already has one", () => {
    const own: V2Item = { id: "c", type: "container", accentColor: "", children: [
      { id: "b", type: "buttonRow", buttons: [{ id: "x", label: "Go", __verify: true, style: "success" }] } as any,
      text("Below the button") as any,
    ] };
    const { ref } = mount({ initialItems: [own], lockedItems: [verifyRow()] });
    const saved = buttons(ref.current!.getItems());
    expect(saved).toHaveLength(1);
    expect(saved[0].label).toBe("Go");
  });

  it("keeps the session menu's options fixed but lets each be reworded", () => {
    const { ref } = mount({ initialItems: [text("Session manager")], lockedItems: [menu()] });
    expect(screen.getByDisplayValue("What do you want to do?")).toBeTruthy();
    expect(screen.queryByText("Add option")).toBeNull();
    expect(screen.queryByText("Ephemeral message")).toBeNull();
    fireEvent.change(screen.getByDisplayValue("Start a session vote"), { target: { value: "Ask for a vote" } });
    const saved = ref.current!.getItems();
    const m = saved.flatMap((it: any) => it.type === "container" ? it.children : [it]).find((c: any) => c.type === "select_menu") as any;
    expect(m.__session_menu).toBe(true);
    expect(m.options).toHaveLength(4);
    expect(m.options[0]).toEqual({ label: "Ask for a vote", description: "Post a vote", display: true });
  });

  it("locks the giveaway's Enter button the same way", () => {
    const { ref } = mount({ initialItems: [text("Win a car")], giveaway: true });
    expect(screen.getAllByTitle(LOCK).length).toBeGreaterThanOrEqual(1);
    expect(buttons(ref.current!.getItems()).some((b) => b.counter)).toBe(true);
  });

  it("leaves an ordinary button row deletable", () => {
    const row: V2Item = { id: "r", type: "buttonRow", buttons: [{ id: "l", label: "Site", url: "https://x.y", style: "link" }] };
    const { ref, container } = mount({ initialItems: [text("Hi"), row] });
    expect(screen.queryAllByTitle(LOCK)).toHaveLength(0);
    const trashes = Array.from(container.querySelectorAll('svg[class*="trash"]')).map((s) => s.closest("button")!);
    // Text block, the row, and the row's own button: three delete controls.
    expect(trashes.length).toBe(3);
    fireEvent.click(trashes[1]);
    expect(leafTypes(ref.current!.getItems())).toEqual(["text"]);
  });
});
