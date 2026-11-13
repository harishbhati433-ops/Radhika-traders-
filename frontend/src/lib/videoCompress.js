// Browser-side video re-encode (canvas + MediaRecorder) — zero server RAM/CPU.
export const canCompressVideo = () => typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";

// Prefer MP4/H.264 (hardware-decoded everywhere, incl. iPhone); fall back to WebM VP8 (cheap to decode on old Androids), then VP9.
const MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];

// Reliable duration even for WebM files without duration metadata (MediaRecorder / screen recorders report Infinity).
export const videoDuration = (file) => new Promise((res) => {
  const v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
  const url = URL.createObjectURL(file);
  const finish = (d) => { URL.revokeObjectURL(url); res(Number.isFinite(d) ? d : 0); };
  v.onerror = () => finish(0);
  v.onloadedmetadata = () => {
    if (Number.isFinite(v.duration)) return finish(v.duration);
    v.ondurationchange = () => Number.isFinite(v.duration) && finish(v.duration);
    v.currentTime = 1e101;
  };
  v.src = url;
});

export async function compressVideo(file, { maxW = 720, maxH = 1280, videoBps = 1_200_000, audioBps = 96_000, onProgress } = {}) {
  const mime = MIMES.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error("unsupported");
  const duration = await videoDuration(file);
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  Object.assign(video, { src: url, muted: true, playsInline: true, preload: "auto" });
  await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error("Video load failed")); });
  const scale = Math.min(1, maxW / video.videoWidth, maxH / video.videoHeight);
  const w = Math.round((video.videoWidth * scale) / 2) * 2, h = Math.round((video.videoHeight * scale) / 2) * 2;
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(30);
  try { (video.captureStream?.() || video.mozCaptureStream?.())?.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch { /* no audio capture support → video only */ }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: videoBps, audioBitsPerSecond: audioBps });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => { rec.onstop = res; });
  const draw = () => { ctx.drawImage(video, 0, 0, w, h); onProgress?.(duration ? Math.min(1, video.currentTime / duration) : 0); };
  const timer = setInterval(draw, 1000 / 30);
  video.onended = () => { clearInterval(timer); draw(); setTimeout(() => rec.state !== "inactive" && rec.stop(), 150); };
  rec.start(500);
  await video.play();
  await stopped;
  URL.revokeObjectURL(url); stream.getTracks().forEach((t) => t.stop());
  const type = mime.split(";")[0], ext = type === "video/mp4" ? "mp4" : "webm";
  return new File([new Blob(chunks, { type })], file.name.replace(/\.[^.]+$/, "") + `-compressed.${ext}`, { type });
}

// Grab one frame (~0.5s in) as a small JPEG — used as the story ring thumbnail.
export const videoThumbnail = (file, size = 320) => new Promise((res) => {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  Object.assign(v, { src: url, muted: true, playsInline: true, preload: "auto" });
  const fail = () => { URL.revokeObjectURL(url); res(null); };
  v.onerror = fail;
  v.onloadeddata = () => { v.currentTime = Math.min(0.5, (Number.isFinite(v.duration) ? v.duration : 1) / 2); };
  v.onseeked = () => {
    const scale = Math.min(1, size / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas"); c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => { URL.revokeObjectURL(url); res(b ? new File([b], "thumb.jpg", { type: "image/jpeg" }) : null); }, "image/jpeg", 0.82);
  };
  setTimeout(fail, 8000);
});
