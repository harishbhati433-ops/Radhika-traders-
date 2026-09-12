import { useEffect, useRef } from "react";

// Re-runs `fn` every `ms` and whenever the tab regains focus, so admin changes reflect without a manual refresh.
export function useLivePoll(fn, deps = [], ms = 20000) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    ref.current();
    const t = setInterval(() => document.visibilityState === "visible" && ref.current(), ms);
    const onFocus = () => ref.current();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
