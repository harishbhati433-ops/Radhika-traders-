import { Phone, Mail } from "lucide-react";

export function PhoneLink({ value, testId }) {
  if (!value) return null;
  return (
    <a href={`tel:+91${String(value).replace(/\D/g, "").slice(-10)}`} data-testid={testId}
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-600 hover:text-white">
      <Phone className="h-3.5 w-3.5" /> {value}
    </a>
  );
}

export function EmailLink({ value, testId }) {
  if (!value) return null;
  return (
    <a href={`mailto:${value}`} data-testid={testId}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-600 hover:text-white">
      <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{value}</span>
    </a>
  );
}
