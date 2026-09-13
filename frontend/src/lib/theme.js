const KEY = "rt_theme";

export const getTheme = () => (localStorage.getItem(KEY) === "dark" ? "dark" : "light");

export function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0B0F17" : "#B91C1C");
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event("rt:theme"));
}
