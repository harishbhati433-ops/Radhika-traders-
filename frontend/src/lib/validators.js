export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_RE = /^\d{12}$/;

export const formatPan = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
export const formatAadhaar = (v) => String(v || "").replace(/\D/g, "").slice(0, 12);

export const panError = (v) => (!v ? "" : PAN_RE.test(v) ? "" : "Invalid PAN. Format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)");
export const aadhaarError = (v) => (!v ? "" : AADHAAR_RE.test(v) ? "" : `Aadhaar must be exactly 12 digits (${v.length}/12 entered)`);
