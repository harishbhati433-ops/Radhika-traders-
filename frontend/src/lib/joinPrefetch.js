import api from "./api";

// Starts the /join/{slug} request the moment the bundle executes (parallel with React boot), so the form is ready sooner.
const cache = {};
export function fetchJoinInfo(slug, ref, via) {
  const key = `${slug}|${ref || ""}|${via || ""}`;
  if (!cache[key]) {
    cache[key] = api.get(`/join/${slug}`, { params: { ...(ref ? { ref } : {}), ...(via ? { via } : {}) } }).then(({ data }) => data);
    cache[key].catch(() => { delete cache[key]; });
  }
  return cache[key];
}

export function prefetchJoinFromLocation() {
  try {
    const m = window.location.pathname.match(/^\/join\/([^/]+)/);
    if (!m) return;
    const q = new URLSearchParams(window.location.search);
    const slug = decodeURIComponent(m[1]);
    fetchJoinInfo(slug, q.get("ref") || localStorage.getItem(`rt_ref_${slug}`) || "", q.get("via") || "");
  } catch {}
}
