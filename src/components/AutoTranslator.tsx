import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * AutoTranslator
 * ----------------
 * Walks the rendered DOM and translates visible English text into the user's
 * preferred language using the `translate` edge function (Lovable AI).
 * Translations are cached in localStorage so the page doesn't re-translate on
 * reload.
 *
 * To exclude a node from translation, add `data-no-translate` to it (or any
 * ancestor). Inputs, textareas, scripts, styles, and code blocks are skipped
 * automatically. The text-input value of form fields is NEVER touched —
 * only visible text nodes are mutated.
 */

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA",
  "INPUT", "SELECT", "OPTION", "SVG", "PATH",
]);

function shouldSkip(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (SKIP_TAGS.has(cur.tagName)) return true;
    if (cur.hasAttribute?.("data-no-translate")) return true;
    if (cur.getAttribute?.("contenteditable") === "true") return true;
    cur = cur.parentElement;
  }
  return false;
}

// Heuristic: is the string worth translating?
function isTranslatable(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return false;
  if (!/[a-zA-Z]/.test(t)) return false; // need at least one letter
  if (/^[\d\s.,$€£¥%:/\\\-+*=()]+$/.test(t)) return false; // pure numerics/symbols
  return true;
}

type CachedNode = {
  node: Text;
  original: string;
};

export function AutoTranslator() {
  const { prefs } = usePreferences();
  const lang = prefs.preferred_language;
  const originalsRef = useRef<WeakMap<Text, string>>(new WeakMap());
  const inFlightRef = useRef<Set<string>>(new Set());
  const debounceRef = useRef<number | null>(null);
  // Bumped on every language change so the MutationObserver-driven pass
  // ignores its own writes from the previous language.
  const passIdRef = useRef(0);
  // Tracks text nodes we've mutated so we don't treat translated text as the
  // "original English" the next time the observer fires.
  const mutatedRef = useRef<WeakSet<Text>>(new WeakSet());

  useEffect(() => {
    if (typeof window === "undefined") return;

    passIdRef.current += 1;
    const cacheKey = (s: string) => `oversite-tr:${lang}:${s}`;

    const setNodeValue = (node: Text, value: string, markMutated = true) => {
      if (node.nodeValue !== value) node.nodeValue = value;
      if (markMutated) mutatedRef.current.add(node);
      else mutatedRef.current.delete(node);
    };

    const collectTextNodes = (root: Node): CachedNode[] => {
      const out: CachedNode[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.nodeValue ?? "";
          if (!isTranslatable(text)) return NodeFilter.FILTER_REJECT;
          if (shouldSkip((node as Text).parentElement)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const tn = n as Text;
        // Only learn the "original English" text from nodes we've never
        // mutated. Otherwise switching from es → fr would treat the Spanish
        // string as the source.
        if (!originalsRef.current.has(tn) && !mutatedRef.current.has(tn)) {
          originalsRef.current.set(tn, tn.nodeValue ?? "");
        }
        const original = originalsRef.current.get(tn);
        if (original && isTranslatable(original)) {
          out.push({ node: tn, original });
        }
      }
      return out;
    };

    const restoreToEnglish = () => {
      const all = collectTextNodes(document.body);
      for (const { node, original } of all) {
        if (mutatedRef.current.has(node)) setNodeValue(node, original, false);
      }
    };

    const applyCachedAndCollectMisses = (nodes: CachedNode[]) => {
      const misses = new Set<string>();
      for (const { node, original } of nodes) {
        const cached = localStorage.getItem(cacheKey(original));
        if (cached !== null) {
          setNodeValue(node, cached);
        } else {
          if (!inFlightRef.current.has(original)) misses.add(original);
        }
      }
      return Array.from(misses);
    };

    const fetchTranslations = async (strings: string[]) => {
      if (strings.length === 0) return;
      strings.forEach((s) => inFlightRef.current.add(s));

      // Chunk into batches of 50 to keep payloads small.
      const chunks: string[][] = [];
      for (let i = 0; i < strings.length; i += 50) chunks.push(strings.slice(i, i + 50));

      const startedPass = passIdRef.current;
      try {
        const results: Record<string, string> = {};
        for (const chunk of chunks) {
          const { data, error } = await supabase.functions.invoke("translate", {
            body: { strings: chunk, target: lang },
          });
          if (error) throw error;
          const translations: string[] = (data?.translations as string[]) ?? [];
          chunk.forEach((src, i) => {
            const tr = translations[i] ?? src;
            results[src] = tr;
            try { localStorage.setItem(cacheKey(src), tr); } catch { /* quota */ }
          });
        }
        // Bail if the user switched languages mid-flight
        if (startedPass !== passIdRef.current) return;
        // Apply to currently visible nodes
        const all = collectTextNodes(document.body);
        for (const { node, original } of all) {
          const tr = results[original];
          if (tr) setNodeValue(node, tr);
        }
      } catch (e) {
        console.error("translate failed:", e);
      } finally {
        strings.forEach((s) => inFlightRef.current.delete(s));
      }
    };

    const runPass = () => {
      if (lang === "en") {
        restoreToEnglish();
        return;
      }
      const nodes = collectTextNodes(document.body);
      const misses = applyCachedAndCollectMisses(nodes);
      if (misses.length > 0) {
        void fetchTranslations(misses);
      }
    };

    const schedule = () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(runPass, 150);
    };

    // Initial pass
    runPass();

    // Watch for DOM changes (route changes, dialogs, async content)
    const observer = new MutationObserver(() => schedule());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [lang]);

  return null;
}
