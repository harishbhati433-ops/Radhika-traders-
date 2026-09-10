export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_RE = /^\d{12}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[\w.\-]{2,}@[A-Za-z]{2,}$/;

export const formatPan = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
export const formatAadhaar = (v) => String(v || "").replace(/\D/g, "").slice(0, 12);
export const formatIfsc = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);

export const panError = (v) => (!v ? "" : PAN_RE.test(v) ? "" : "Invalid PAN. Format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)");
export const aadhaarError = (v) => (!v ? "" : AADHAAR_RE.test(v) ? "" : `Aadhaar must be exactly 12 digits (${v.length}/12 entered)`);
export const ifscError = (v) => {
  if (!v) return "";
  if (v.length < 11) return `IFSC must be 11 characters (${v.length}/11 entered) — e.g. HDFC0001234`;
  if (!/^[A-Z]{4}/.test(v)) return "First 4 characters must be the bank code letters (e.g. HDFC)";
  if (v[4] !== "0") return "5th character of an IFSC is always 0";
  return IFSC_RE.test(v) ? "" : "Invalid IFSC. Format: 4 letters + 0 + 6 letters/digits (e.g. HDFC0001234)";
};
export const upiError = (v) => (!v ? "" : UPI_RE.test(v.trim()) ? "" : "Invalid UPI ID. Format: name@bank (e.g. rahul@upi)");
