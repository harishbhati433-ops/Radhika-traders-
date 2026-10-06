import api from "./api";

const b64ToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const bytesToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const credentialJSON = (c) => {
  const r = c.response;
  const response = { clientDataJSON: bytesToB64(r.clientDataJSON) };
  if (r.attestationObject) response.attestationObject = bytesToB64(r.attestationObject);
  if (r.authenticatorData) response.authenticatorData = bytesToB64(r.authenticatorData);
  if (r.signature) response.signature = bytesToB64(r.signature);
  if (r.userHandle) response.userHandle = bytesToB64(r.userHandle);
  if (r.getTransports) response.transports = r.getTransports();
  return { id: c.id, rawId: bytesToB64(c.rawId), type: c.type, response, clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {}, authenticatorAttachment: c.authenticatorAttachment || null };
};

export const webauthnSupported = () => window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials;

export async function biometricAvailable() {
  try { return webauthnSupported() && (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}

export async function registerBiometric() {
  const { data: o } = await api.post("/app-lock/biometric/register/options");
  const cred = await navigator.credentials.create({ publicKey: { ...o, challenge: b64ToBytes(o.challenge), user: { ...o.user, id: b64ToBytes(o.user.id) }, excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: b64ToBytes(c.id) })) } });
  if (!cred) throw new Error("Cancelled");
  return (await api.post("/app-lock/biometric/register/finish", credentialJSON(cred))).data;
}

export async function unlockBiometric() {
  const { data: o } = await api.post("/app-lock/biometric/unlock/options");
  const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: b64ToBytes(o.challenge), allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: b64ToBytes(c.id) })) } });
  if (!cred) throw new Error("Cancelled");
  return (await api.post("/app-lock/biometric/unlock/finish", credentialJSON(cred))).data;
}
