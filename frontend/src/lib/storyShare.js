// Story sharing helpers: public link with the customer's referral, canvas render of text stories, downloads, platform intents.
import api, { fileUrl } from "./api";
import { fontCss } from "./storyFonts";

export const storyShareUrl = (story, code) => `${window.location.origin}/s/${story.id}${code ? `?ref=${encodeURIComponent(code)}` : ""}`;

export const storyShareText = (story, url) => {
  const head = story.kind === "campaign" ? `🔥 ${story.title}${story.payout ? ` — Payout ₹${story.payout}` : ""}` : `✨ ${story.title || "Radhika Traders"}`;
  return `${head}\n${story.caption ? story.caption + "\n" : ""}\n👉 ${url}\n\n🏆 Radhika Traders · Trusted Partner for Financial Growth`;
};

export const logShare = (storyId, platform) => api.post(`/stories/${storyId}/share`, { platform }).catch(() => {});

const wrap = (ctx, text, maxW) => {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
};

// 1080×1920 PNG of a text story — ready for Instagram / Facebook / WhatsApp Status.
export async function renderTextStoryPng(story, url) {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1920;
  const ctx = c.getContext("2d");
  const bg = story.bg_color || "#0B0F17";
  const g = ctx.createLinearGradient(0, 0, 0, 1920);
  g.addColorStop(0, bg); g.addColorStop(1, "#0B0F17");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(200 + i * 160, 300 + (i % 2) * 1300, 220, 0, Math.PI * 2); ctx.fill(); }
  const f = fontCss(story.font);
  const fam = String(f.fontFamily).replace(/var\([^)]*\)/, "'Manrope'");
  ctx.textAlign = "center"; ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 24;
  ctx.font = `${f.fontWeight || 800} 96px ${fam}`;
  const titleLines = wrap(ctx, story.title || "", 920);
  ctx.font = `500 50px 'Manrope', system-ui, sans-serif`;
  const capLines = story.caption ? wrap(ctx, story.caption, 880) : [];
  const total = titleLines.length * 110 + (capLines.length ? 40 + capLines.length * 66 : 0) + (story.payout ? 150 : 0);
  let y = Math.max(420, (1920 - total) / 2);
  ctx.font = `${f.fontWeight || 800} 96px ${fam}`;
  for (const l of titleLines) { ctx.fillText(l, 540, y); y += 110; }
  if (capLines.length) { y += 40; ctx.font = `500 50px 'Manrope', system-ui, sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.92)"; for (const l of capLines) { ctx.fillText(l, 540, y); y += 66; } }
  if (story.payout) {
    y += 70; ctx.shadowBlur = 0;
    ctx.fillStyle = "#F59E0B"; const w = 520; ctx.beginPath(); ctx.roundRect(540 - w / 2, y - 60, w, 110, 55); ctx.fill();
    ctx.fillStyle = "#0B0F17"; ctx.font = `800 56px 'JetBrains Mono', monospace`; ctx.fillText(`Payout ₹${story.payout}`, 540, y + 18);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 1640, 1080, 280);
  ctx.fillStyle = "#fff"; ctx.font = `800 52px 'Outfit', 'Manrope', sans-serif`; ctx.fillText("RADHIKA TRADERS", 540, 1730);
  ctx.fillStyle = "#FCD34D"; ctx.font = `600 30px 'Manrope', sans-serif`; ctx.fillText("TRUSTED PARTNER FOR FINANCIAL GROWTH", 540, 1780);
  ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = `500 34px 'Manrope', sans-serif`; ctx.fillText(url.replace(/^https?:\/\//, ""), 540, 1850);
  return new Promise((res) => c.toBlob(res, "image/png", 0.95));
}

export async function storyBlob(story, url) {
  if (story.media_type === "text" || !story.media_url) return { blob: await renderTextStoryPng(story, url), name: `radhika-story-${story.id}.png` };
  const r = await fetch(fileUrl(story.media_url));
  if (!r.ok) throw new Error("download failed");
  const blob = await r.blob();
  const ext = story.media_type === "video" ? (blob.type.includes("webm") ? "webm" : "mp4") : (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  return { blob, name: `radhika-story-${story.id}.${ext}` };
}

export function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

export const canShareFiles = (files) => !!navigator.share && (!navigator.canShare || navigator.canShare({ files }));

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

export const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
