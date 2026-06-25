import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Slim top progress bar that sweeps on every route change. Re-keyed per
 * navigation so the one-shot CSS animation replays. No spinner by design.
 */
export function RouteProgress() {
  const { pathname } = useLocation();
  const [tick, setTick] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return; // skip the very first render (initial page load)
    }
    setTick((t) => t + 1);
  }, [pathname]);

  if (tick === 0) return null;
  return <div key={tick} className="route-progress" aria-hidden />;
}
