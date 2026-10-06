// Stable-ish device identity for one-device-one-reward: a persistent random id + a hash of browser/hardware traits.
const ID_KEY = "rt_device_id";

const hash = (s) => {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2654435761) >>> 0; }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
};

const canvasTrait = () => {
  try {
    const c = document.createElement("canvas"); c.width = 200; c.height = 40;
    const x = c.getContext("2d");
    x.textBaseline = "top"; x.font = "14px 'Arial'"; x.fillStyle = "#f60"; x.fillRect(100, 1, 60, 20);
    x.fillStyle = "#069"; x.fillText("RadhikaTraders@2026", 2, 15); x.fillStyle = "rgba(102,204,0,0.7)"; x.fillText("RadhikaTraders@2026", 4, 17);
    return c.toDataURL().slice(-64);
  } catch { return ""; }
};

const glTrait = () => {
  try {
    const gl = document.createElement("canvas").getContext("webgl") || document.createElement("canvas").getContext("experimental-webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext ? `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}` : "";
  } catch { return ""; }
};

export function getDeviceFingerprint() {
  const n = navigator, s = window.screen;
  const traits = [n.userAgent, n.language, (n.languages || []).join(","), n.platform, n.hardwareConcurrency, n.deviceMemory, n.maxTouchPoints,
    s.width, s.height, s.colorDepth, window.devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, canvasTrait(), glTrait()];
  return hash(traits.join("§"));
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/-/g, ""); localStorage.setItem(ID_KEY, id); }
    return id;
  } catch { return ""; }
}
