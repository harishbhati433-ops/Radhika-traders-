import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Slider } from "./ui/slider";
import { Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

async function cropToBlob(src, area, rotation) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
  const bw = img.width * cos + img.height * sin, bh = img.width * sin + img.height * cos;
  const c = document.createElement("canvas");
  c.width = bw; c.height = bh;
  const ctx = c.getContext("2d");
  ctx.translate(bw / 2, bh / 2); ctx.rotate(rad); ctx.translate(-img.width / 2, -img.height / 2);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(area.x, area.y, area.width, area.height);
  const out = document.createElement("canvas");
  const size = 512;
  out.width = size; out.height = size;
  const tmp = document.createElement("canvas");
  tmp.width = area.width; tmp.height = area.height;
  tmp.getContext("2d").putImageData(data, 0, 0);
  out.getContext("2d").drawImage(tmp, 0, 0, size, size);
  return new Promise((res) => out.toBlob(res, "image/jpeg", 0.9));
}

export function AvatarCropDialog({ src, open, onCancel, onDone }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState(null);
  const [busy, setBusy] = useState(false);
  const onComplete = useCallback((_, px) => setArea(px), []);

  const save = async () => {
    if (!area) return;
    setBusy(true);
    try { onDone(await cropToBlob(src, area, rotation)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onCancel()}>
      <DialogContent className="max-w-md p-0 overflow-hidden" data-testid="avatar-crop-dialog">
        <DialogHeader className="px-5 pt-5"><DialogTitle className="font-display">Adjust your photo</DialogTitle></DialogHeader>
        <div className="relative h-80 w-full bg-slate-950 touch-none" data-testid="avatar-crop-area">
          {src && <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={1} cropShape="round" showGrid={false}
            onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />}
        </div>
        <div className="space-y-4 px-5 pb-5 pt-4">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 shrink-0 text-slate-400" />
            <Slider data-testid="avatar-zoom-slider" min={1} max={4} step={0.01} value={[zoom]} onValueChange={([v]) => setZoom(v)} className="flex-1" />
            <ZoomIn className="h-4 w-4 shrink-0 text-slate-400" />
            <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} data-testid="avatar-rotate-btn" aria-label="Rotate" className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><RotateCw className="h-4 w-4" /></button>
          </div>
          <p className="text-center text-[11px] text-slate-400">Drag to move · pinch or slide to zoom · keep your face inside the circle</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} disabled={busy} data-testid="avatar-crop-cancel" className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={save} disabled={busy || !area} data-testid="avatar-crop-save" className="rt-gradient-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save photo
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
