import { Megaphone } from "lucide-react";

const PALETTE = [
  "bg-red-50 text-red-700 border-red-200",
  "bg-sky-50 text-sky-700 border-sky-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-pink-50 text-pink-700 border-pink-200",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
];

const tone = (name = "") => PALETTE[[...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % PALETTE.length];

export function CampaignChip({ name, size = "sm", testId }) {
  if (!name) return null;
  const pad = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide ${pad} ${tone(name)}`}>
      <Megaphone className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} /> {name}
    </span>
  );
}
