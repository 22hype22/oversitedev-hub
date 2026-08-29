import { useEffect } from "react";

type SeoOptions = {
  title: string;
  description: string;
  canonical: string;
  /** Optional page-scoped JSON-LD. Pass a module-level const for a stable ref. */
  jsonLd?: object;
};

/**
 * Lightweight per-route SEO for this SPA (no react-helmet dependency). Sets the
 * document title, description, og:title/description, canonical, and injects a
 * page-scoped JSON-LD block — then restores everything on unmount. Modern
 * crawlers (Google, and the JS-rendering AI answer engines) pick these up; the
 * static index.html head remains the baseline for non-JS crawlers.
 */
export function usePageSeo({ title, description, canonical, jsonLd }: SeoOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const restores: Array<() => void> = [];

    const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      let created = false;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        created = true;
      }
      const prev = el.getAttribute("content");
      el.setAttribute("content", content);
      restores.push(() => {
        if (created) el!.remove();
        else if (prev !== null) el!.setAttribute("content", prev);
      });
    };

    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);

    let canon = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    let canonCreated = false;
    const prevCanon = canon?.getAttribute("href") ?? null;
    if (!canon) {
      canon = document.createElement("link");
      canon.rel = "canonical";
      document.head.appendChild(canon);
      canonCreated = true;
    }
    canon.setAttribute("href", canonical);

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-page-seo", "1");
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.title = prevTitle;
      restores.forEach((r) => r());
      if (canon) {
        if (canonCreated) canon.remove();
        else if (prevCanon !== null) canon.setAttribute("href", prevCanon);
      }
      if (script) script.remove();
    };
  }, [title, description, canonical, jsonLd]);
}
