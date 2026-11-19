import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Link2, Share2, Loader2, Check, Send, Instagram, Facebook, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { storyShareUrl, storyShareText, logShare, storyBlob, saveBlob, canShareFiles, copyText, isMobile } from "../lib/storyShare";

const Tile = ({ icon: Icon, label, hint, tone, onClick, busy, testId }) => (
  <button type="button" onClick={onClick} disabled={busy} data-testid={testId}
    className="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-white transition-colors active:bg-white/15 disabled:opacity-50">
    <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tone}`}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}</span>
    <span className="text-xs font-bold">{label}</span>
    {hint && <span className="text-[10px] leading-tight text-white/60">{hint}</span>}
  </button>
);

// Bottom sheet: share a story to WhatsApp / Instagram / Facebook / Telegram, download it, or copy the referral link.
export function StoryShareSheet({ story, user, onClose }) {
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const url = storyShareUrl(story, user?.referral_code);
  const text = storyShareText(story, url);
  const mobile = isMobile();

  const run = async (platform, fn) => {
    setBusy(platform);
    try { await fn(); logShare(story.id, platform); }
    catch (e) { if (!/abort|cancel/i.test(String(e?.name || e?.message))) toast.error("Share nahi ho paaya — Download karke manually share karein"); }
    finally { setBusy(""); }
  };
  const getFile = async () => { const { blob, name } = await storyBlob(story, url); return new File([blob], name, { type: blob.type }); };
  const nativeWithFile = async (title) => {
    const file = await getFile();
    if (canShareFiles([file])) { await navigator.share({ files: [file], title, text }); return true; }
    return false;
  };
  const copy = async (p = "copy") => { if (await copyText(url)) { setCopied(true); setTimeout(() => setCopied(false), 1800); toast.success("Link copied — referral code included"); logShare(story.id, p); } };

  const whatsapp = () => run("whatsapp", async () => {
    if (mobile && await nativeWithFile(story.title)) return; // user picks WhatsApp → "My Status" or a chat
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });
  const telegram = () => run("telegram", async () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text.replace(url, "").trim())}`, "_blank", "noopener"); });
  const facebook = () => run("facebook", async () => {
    if (mobile && await nativeWithFile(story.title)) return; // Facebook app → "Your story" from the share sheet
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, "_blank", "noopener,width=640,height=560");
  });
  const instagram = () => run("instagram", async () => {
    // Instagram has no web posting API for personal accounts: give the user the file + caption, then open the Story camera.
    await copyText(text);
    if (mobile && await nativeWithFile(story.title)) { toast.success("Caption + link copied — paste it in your Instagram story"); return; }
    const { blob, name } = await storyBlob(story, url); saveBlob(blob, name);
    toast.success("Story downloaded & caption copied — upload it in Instagram → Your Story", { duration: 6000 });
    if (mobile) setTimeout(() => { window.location.href = "instagram://story-camera"; }, 900);
  });
  const download = () => run("download", async () => { const { blob, name } = await storyBlob(story, url); saveBlob(blob, name); toast.success("Story saved to your device"); });
  const native = () => run("native", async () => {
    if (mobile && await nativeWithFile(story.title)) return;
    if (navigator.share) { await navigator.share({ title: story.title, text, url }); return; }
    await copy("native");
  });

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 sm:items-center" data-testid="story-share-sheet" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-[#0B0F17] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-lg font-bold">Share this story</div>
            <p className="mt-0.5 text-xs text-white/60">Aapka referral code link mein hai — isse join karne wale aapke referral banenge.</p>
          </div>
          <button type="button" onClick={onClose} data-testid="story-share-close" aria-label="Close" className="rounded-full bg-white/10 p-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Tile icon={MessageCircle} label="WhatsApp" hint={mobile ? "Status / chat" : ""} tone="bg-emerald-500" onClick={whatsapp} busy={busy === "whatsapp"} testId="story-share-whatsapp" />
          <Tile icon={Instagram} label="Instagram" hint="Story" tone="bg-gradient-to-br from-fuchsia-600 via-rose-500 to-amber-400" onClick={instagram} busy={busy === "instagram"} testId="story-share-instagram" />
          <Tile icon={Facebook} label="Facebook" hint={mobile ? "Story / feed" : "Feed"} tone="bg-blue-600" onClick={facebook} busy={busy === "facebook"} testId="story-share-facebook" />
          <Tile icon={Send} label="Telegram" tone="bg-sky-500" onClick={telegram} busy={busy === "telegram"} testId="story-share-telegram" />
          <Tile icon={Download} label="Download" hint={story.media_type === "text" ? "1080×1920" : ""} tone="bg-white/15" onClick={download} busy={busy === "download"} testId="story-share-download" />
          <Tile icon={copied ? Check : Link2} label={copied ? "Copied" : "Copy link"} tone="bg-white/15" onClick={() => copy()} testId="story-share-copy" />
          <Tile icon={Share2} label="More" hint="Other apps" tone="bg-white/15" onClick={native} busy={busy === "native"} testId="story-share-native" />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
          <Link2 className="h-4 w-4 shrink-0 text-amber-300" />
          <span className="truncate font-mono text-[11px] text-white/80" data-testid="story-share-url">{url}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
