import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Send, Mic, MicOff, Volume2, VolumeX, MessageCircle, Loader2, Paperclip, ImageIcon, FolderOpen } from "lucide-react";
import { useContact, waLink } from "../lib/contact";
import { getToken } from "../lib/portal";

const API = process.env.REACT_APP_BACKEND_URL;
const SID_KEY = "rt_assistant_sid";
const SPEAK_KEY = "rt_assistant_speak";
const HIDE_ON = ["/app/login", "/app/signup", "/app/forgot-password", "/app/forgot-email"];
const SUGGEST = ["Earning kaise hoti hai?", "Withdrawal kaise milega?", "KYC kaise karein?", "Abhi kaun se offers live hain?"];
const SUGGEST_IN = ["Mera wallet balance kitna hai?", "Meri withdrawal ka status?", "Meri KYC verified hai?", "Mere leads ka status batao"];
const authHeaders = () => { const t = getToken("customer"); return t ? { Authorization: `Bearer ${t}` } : {}; };
const loggedIn = () => !!getToken("customer");

const sid = () => { let s = localStorage.getItem(SID_KEY); if (!s) { s = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(SID_KEY, s); } return s; };
const clean = (t) => t.replace(/\[SUPPORT\]/g, "").trim();
const isHindi = (t) => /[\u0900-\u097F]/.test(t);

// Downscale in the browser so uploads stay small; returns a JPEG data URL.
async function toDataUrl(file) {
  if (!file.type.startsWith("image/")) throw new Error("Sirf image (JPG/PNG/WEBP) bhej sakte hain");
  if (file.size > 12 * 1024 * 1024) throw new Error("Image 12 MB se badi hai");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function speak(text) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean(text).slice(0, 600));
    const voices = window.speechSynthesis.getVoices();
    const want = isHindi(text) ? "hi" : "en-IN";
    u.voice = voices.find((v) => v.lang.toLowerCase().startsWith(want)) || voices.find((v) => v.lang.toLowerCase().startsWith("en-in")) || voices.find((v) => v.lang.toLowerCase().startsWith("hi")) || null;
    u.lang = u.voice?.lang || (isHindi(text) ? "hi-IN" : "en-IN");
    u.rate = 1; window.speechSynthesis.speak(u);
  } catch {}
}

export function AssistantWidget({ enabled = true }) {
  const { pathname } = useLocation();
  const contact = useContact();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(localStorage.getItem(SPEAK_KEY) !== "off");
  const [image, setImage] = useState("");
  const [attachMenu, setAttachMenu] = useState(false);
  const galleryRef = useRef(null);
  const filesRef = useRef(null);
  const bottomRef = useRef(null);
  const recRef = useRef(null);
  const wantMic = useRef(false);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  useEffect(() => {
    if (!open || msgs.length) return;
    fetch(`${API}/api/assistant/history/${sid()}`).then((r) => r.json()).then((h) => setMsgs(Array.isArray(h) && h.length ? h.map((m) => ({ role: m.role, text: m.content, support: m.content.includes("[SUPPORT]") })) : [{ role: "assistant", text: "Namaste! Main Radhika Voice Assistant hoon. Earning, offers, withdrawal, KYC — kuch bhi poochhiye (Hindi/English)." }])).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);
  useEffect(() => {
    const onOpen = (e) => { setOpen(true); if (e.detail?.mic) wantMic.current = true; };
    window.addEventListener("rt-assistant-open", onOpen);
    return () => window.removeEventListener("rt-assistant-open", onOpen);
  }, []);
  useEffect(() => {
    if (open && wantMic.current) { wantMic.current = false; setTimeout(() => startMic(), 250); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const hidden = !enabled || HIDE_ON.includes(pathname) || pathname.startsWith("/admin") || pathname.startsWith("/employee") || pathname.startsWith("/rt-");

  const ask = async (text) => {
    const q = (text || input).trim();
    const img = image;
    if ((!q && !img) || busy) return;
    setInput(""); setImage(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: q || "📷 Image", image: img }, { role: "assistant", text: "", streaming: true }]);
    try {
      const res = await fetch(`${API}/api/assistant/chat`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ session_id: sid(), message: q, ...(img ? { image_base64: img } : {}) }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Assistant unavailable"); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "", full = "", support = false;
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop();
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue;
          const d = JSON.parse(p.slice(6));
          if (d.t) { full += d.t; setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: full, streaming: true }; return c; }); }
          if (d.done) support = d.support;
        }
      }
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: full, support: support || full.includes("[SUPPORT]") }; return c; });
      if (speakOn) speak(full);
    } catch (e) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: e.message || "Sorry, please try again.", support: true }; return c; });
    }
    setBusy(false);
  };

  const startMic = () => {
    if (!SR || listening || recRef.current) return;
    const rec = new SR(); rec.lang = "hi-IN"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setListening(false); ask(t); };
    rec.onerror = () => { setListening(false); recRef.current = null; }; rec.onend = () => { setListening(false); recRef.current = null; };
    recRef.current = rec; rec.start(); setListening(true);
  };
  const toggleMic = () => {
    if (!SR) return;
    if (listening) { recRef.current?.stop(); recRef.current = null; setListening(false); return; }
    startMic();
  };
  const toggleSpeak = () => { const v = !speakOn; setSpeakOn(v); localStorage.setItem(SPEAK_KEY, v ? "on" : "off"); if (!v) window.speechSynthesis?.cancel(); };
  const pickImage = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; setAttachMenu(false);
    if (!file) return;
    if (!loggedIn()) { setMsgs((m) => [...m, { role: "assistant", text: "Image bhejne ke liye pehle apne Radhika Traders account me login karein." }]); return; }
    try { setImage(await toDataUrl(file)); } catch (err) { setMsgs((m) => [...m, { role: "assistant", text: err.message || "Image load nahi hui" }]); }
  };

  if (hidden) return null;
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} data-testid="assistant-open" aria-label="Radhika Voice Assistant" title="Radhika Voice Assistant"
          className="group fixed bottom-[4.75rem] right-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg ring-2 ring-amber-400/70 transition-transform hover:scale-105 sm:bottom-[5.25rem] sm:right-5 sm:h-12 sm:w-12">
          <Sparkles className="h-5 w-5 text-amber-400" />
          <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold opacity-0 shadow-lg transition-opacity group-hover:opacity-100 sm:block">Radhika Voice Assistant</span>
        </button>
      )}
      {open && (
        <div data-testid="assistant-panel" className="fixed bottom-4 right-4 z-[70] flex h-[min(34rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 border-b-4 border-amber-400 bg-[#991B1B] px-4 py-3 text-white">
            <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
            <div className="min-w-0 flex-1"><div className="text-[10px] font-bold tracking-[0.2em] text-amber-200">RADHIKA TRADERS</div><div className="truncate font-display text-sm font-extrabold">Radhika Voice Assistant</div></div>
            <button onClick={toggleSpeak} data-testid="assistant-speak-toggle" title={speakOn ? "Voice reply on" : "Voice reply off"} className="rounded-full p-1.5 hover:bg-white/15">{speakOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
            <button onClick={() => { setOpen(false); window.speechSynthesis?.cancel(); }} data-testid="assistant-close" className="rounded-full p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3" data-testid="assistant-messages">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.role === "user" ? "rounded-br-md bg-red-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`} data-testid={`assistant-msg-${m.role}`}>
                  {m.image && <img src={m.image} alt="attachment" className="mb-1.5 max-h-40 rounded-lg" data-testid="assistant-msg-image" />}
                  {m.text ? clean(m.text) : <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                  {m.support && !m.streaming && (
                    <a href={waLink(contact.support_mobile, "Hello Radhika Traders support, I need help with: ")} target="_blank" rel="noreferrer" data-testid="assistant-support-btn"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"><MessageCircle className="h-3.5 w-3.5" /> Contact Support (WhatsApp)</a>
                  )}
                </div>
              </div>
            ))}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1" data-testid="assistant-suggestions">
                {(loggedIn() ? SUGGEST_IN : SUGGEST).map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-red-300 hover:text-red-700">{s}</button>)}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {image && (
            <div className="flex items-center gap-2 border-t border-slate-200 bg-amber-50 px-3 py-2" data-testid="assistant-image-preview">
              <img src={image} alt="preview" className="h-12 w-12 rounded-lg object-cover ring-1 ring-amber-300" />
              <div className="min-w-0 flex-1 text-[11px] text-slate-600">Image attached — sawaal likhiye ya seedha send karein. Image store nahi hoti.</div>
              <button type="button" onClick={() => setImage("")} data-testid="assistant-image-remove" className="rounded-full bg-white p-1 text-slate-600 ring-1 ring-slate-200"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="relative flex items-center gap-2 border-t border-slate-200 bg-white p-2.5">
            {attachMenu && (
              <div className="absolute bottom-14 left-2 z-10 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" data-testid="assistant-attach-menu">
                <button type="button" onClick={() => galleryRef.current.click()} data-testid="assistant-attach-gallery" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><ImageIcon className="h-4 w-4 text-red-600" /> Gallery / Photos</button>
                <button type="button" onClick={() => filesRef.current.click()} data-testid="assistant-attach-files" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><FolderOpen className="h-4 w-4 text-amber-600" /> All files</button>
              </div>
            )}
            <button type="button" onClick={() => setAttachMenu((v) => !v)} data-testid="assistant-attach" title="Send a screenshot / image" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${image ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}><Paperclip className="h-4 w-4" /></button>
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pickImage} data-testid="assistant-file-gallery" />
            <input ref={filesRef} type="file" hidden onChange={pickImage} data-testid="assistant-file-all" />
            {SR && <button type="button" onClick={toggleMic} data-testid="assistant-mic" title="Speak your question" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${listening ? "animate-pulse bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>}
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening… boliye" : "Apna sawaal likhiye…"} maxLength={600} data-testid="assistant-input"
              className="h-10 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-red-400" />
            <button type="submit" disabled={busy || (!input.trim() && !image)} data-testid="assistant-send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </form>
          <div className="bg-white px-3 pb-2 text-center text-[10px] text-slate-400">{loggedIn() ? "Your account details are shown only to you, after secure login" : "General info · log in to ask about your own wallet, KYC & leads"}</div>
        </div>
      )}
    </>
  );
}
