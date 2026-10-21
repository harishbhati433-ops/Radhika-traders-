import { Languages } from "lucide-react";
import { useLang, setLang } from "../lib/i18n";

export function LangToggle({ compact }) {
  const lang = useLang();
  const flip = () => setLang(lang === "hi" ? "en" : "hi");
  return (
    <button onClick={flip} data-testid={compact ? "lang-toggle-mobile" : "lang-toggle"} title={lang === "hi" ? "Switch to English" : "हिंदी में देखें"} aria-label="Change language"
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 ${compact ? "h-9 w-9 justify-center p-0" : "px-3 py-1.5"}`}>
      <Languages style={{ width: 16, height: 16 }} className="text-red-600" />
      {!compact && <span>{lang === "hi" ? "English" : "हिंदी"}</span>}
    </button>
  );
}
