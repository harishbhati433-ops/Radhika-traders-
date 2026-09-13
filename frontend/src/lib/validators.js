export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_RE = /^\d{12}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[\w.\-]{2,}@[A-Za-z]{2,}$/;

export const formatPan = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
export const formatAadhaar = (v) => String(v || "").replace(/\D/g, "").slice(0, 12);
export const formatIfsc = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);

const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export const verhoeffValid = (num) => { let c = 0; const d = String(num).split("").reverse(); for (let i = 0; i < d.length; i++) c = VD[c][VP[i % 8][Number(d[i])]]; return c === 0; };

export const panError = (v) => (!v ? "" : PAN_RE.test(v) ? "" : "Invalid PAN. Format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)");
export const aadhaarError = (v) => {
  if (!v) return "";
  if (!AADHAAR_RE.test(v)) return `Aadhaar must be exactly 12 digits (${v.length}/12 entered)`;
  if (v[0] === "0" || v[0] === "1") return "Invalid Aadhaar number — it cannot start with 0 or 1";
  if (/^(\d)\1{11}$/.test(v) || !verhoeffValid(v)) return "Invalid Aadhaar number — please check the digits and try again";
  return "";
};
export const ifscError = (v) => {
  if (!v) return "";
  if (v.length < 11) return `IFSC must be 11 characters (${v.length}/11 entered) — e.g. HDFC0001234`;
  if (!/^[A-Z]{4}/.test(v)) return "First 4 characters must be the bank code letters (e.g. HDFC)";
  if (v[4] !== "0") return "5th character of an IFSC is always 0";
  return IFSC_RE.test(v) ? "" : "Invalid IFSC. Format: 4 letters + 0 + 6 letters/digits (e.g. HDFC0001234)";
};
export const upiError = (v) => (!v ? "" : UPI_RE.test(v.trim()) ? "" : "Invalid UPI ID. Format: name@bank (e.g. rahul@upi)");
