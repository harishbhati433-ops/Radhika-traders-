export const capitalizeName = (name = "") => name.trim().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "")).join(" ");

export function timeGreeting(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(date));
  if (h >= 5 && h < 12) return "Good Morning";
  if (h >= 12 && h < 17) return "Good Afternoon";
  if (h >= 17 && h < 21) return "Good Evening";
  return "Good Night";
}

export const greetingEmoji = (g) => ({ "Good Morning": "🌅", "Good Afternoon": "☀️", "Good Evening": "🌆", "Good Night": "🌙" }[g] || "👋");
