// Chrome Password Manager (Credential Management API): saved logins survive "Clear browsing data", so the app can sign back in with one tap.
const supported = () => window.isSecureContext && !!navigator.credentials && !!window.PasswordCredential;

export const credentialApiSupported = supported;

export async function storeCredential(id, password, name) {
  if (!supported() || !id || !password) return;
  try { await navigator.credentials.store(new window.PasswordCredential({ id, password, name: name || id })); } catch {}
}

export async function getSavedCredential(mediation = "optional") {
  if (!supported()) return null;
  try {
    const c = await navigator.credentials.get({ password: true, mediation });
    return c && c.type === "password" && c.password ? { id: c.id, password: c.password } : null;
  } catch { return null; }
}

export async function forgetAutoLogin() {
  if (!supported()) return;
  try { await navigator.credentials.preventSilentAccess(); } catch {}
}
