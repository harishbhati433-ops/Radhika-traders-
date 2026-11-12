// Font choices for text stories — system/app fonts only (no extra downloads).
export const STORY_FONTS = {
  display: { label: "Bold Display (default)", css: { fontFamily: "var(--font-display, 'Manrope', system-ui, sans-serif)", fontWeight: 800 } },
  clean: { label: "Clean Sans", css: { fontFamily: "'Manrope', 'Segoe UI', system-ui, sans-serif", fontWeight: 600 } },
  serif: { label: "Classic Serif", css: { fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700 } },
  hindi: { label: "Hindi / देवनागरी", css: { fontFamily: "'Noto Sans Devanagari', 'Mangal', 'Nirmala UI', system-ui, sans-serif", fontWeight: 700 } },
  impact: { label: "Impact (Heavy)", css: { fontFamily: "Impact, 'Arial Black', 'Haettenschweiler', sans-serif", fontWeight: 900, letterSpacing: "0.02em" } },
  cursive: { label: "Handwriting", css: { fontFamily: "'Brush Script MT', 'Segoe Script', 'Comic Sans MS', cursive", fontWeight: 600 } },
  mono: { label: "Typewriter", css: { fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontWeight: 700 } },
};
export const fontCss = (key) => (STORY_FONTS[key] || STORY_FONTS.display).css;
