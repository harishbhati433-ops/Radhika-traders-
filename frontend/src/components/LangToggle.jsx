import { useLang, setLang } from "../lib/i18n";

const OPTS = [["en", "EN", "English"], ["hi", "हिंदी", "Hindi"]];

export function LangToggle({ compact }) {
  const lang = useLang();
  return (
    <div data-testid={compact ? "lang-toggle-mobile" : "lang-toggle"} role="group" aria-label="Language / भाषा" title="Language / भाषा"
      className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 text-xs font-bold shadow-sm">
      {OPTS.map(([code, label, aria]) => {
        const on = lang === code;
        return (
          <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={on} aria-label={aria} data-testid={`lang-${code}`}
            className={`rounded-full px-3 py-1.5 leading-none transition-colors ${on ? "bg-red-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
