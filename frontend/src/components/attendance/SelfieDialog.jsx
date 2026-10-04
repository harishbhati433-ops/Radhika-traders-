import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, Check } from "lucide-react";

// Live front-camera selfie → 640px JPEG data URL (~40–60 KB). Verification/geofence happen on the backend.
export function SelfieDialog({ open, onCapture, onClose, kind = "check-in" }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [shot, setShot] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setShot(null); setErr("");
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then((s) => { stream.current = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } })
      .catch((e) => setErr(e?.name === "NotAllowedError" ? "Camera permission denied. Please allow camera access and try again." : "Could not open the camera on this device."));
    return () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  }, [open]);

  if (!open) return null;
  const take = () => {
    const v = video.current; if (!v || !v.videoWidth) return;
    const size = 640, c = document.createElement("canvas"); c.width = size; c.height = size;
    const s = Math.min(v.videoWidth, v.videoHeight), sx = (v.videoWidth - s) / 2, sy = (v.videoHeight - s) / 2;
    const ctx = c.getContext("2d"); ctx.translate(size, 0); ctx.scale(-1, 1); ctx.drawImage(v, sx, sy, s, s, 0, 0, size, size);
    setShot(c.toDataURL("image/jpeg", 0.72));
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" data-testid="selfie-dialog">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3"><div className="flex items-center gap-2 text-sm font-bold"><Camera className="h-4 w-4 text-amber-300" /> Live selfie for {kind === "check-out" ? "check-out" : "check-in"}</div><button onClick={onClose} data-testid="selfie-close" className="rounded-full p-1 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
        <div className="relative aspect-square bg-black">
          {shot ? <img src={shot} alt="Your selfie" className="h-full w-full object-cover" data-testid="selfie-preview" /> : <video ref={video} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" data-testid="selfie-video" />}
          {err && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-rose-300" data-testid="selfie-error">{err}</div>}
        </div>
        <div className="flex items-center justify-center gap-3 p-4">
          {shot ? <>
            <button onClick={() => setShot(null)} data-testid="selfie-retake" className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Retake</button>
            <button onClick={() => onCapture(shot)} data-testid="selfie-use" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-400"><Check className="h-4 w-4" /> Use this &amp; {kind === "check-out" ? "Check Out" : "Check In"}</button>
          </> : <button onClick={take} disabled={!!err} data-testid="selfie-capture" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-50"><Camera className="h-4 w-4" /> Capture</button>}
        </div>
        <p className="px-4 pb-4 text-center text-[11px] text-slate-400">Photo is stored for attendance proof only and auto-deleted after the retention period.</p>
      </div>
    </div>
  );
}

export function getLivePosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This device/browser has no GPS support."));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? "Location permission denied. Please allow location access for attendance." : e.code === 3 ? "Could not get your location in time. Please try again." : "Could not read your location. Turn on GPS and try again.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}
