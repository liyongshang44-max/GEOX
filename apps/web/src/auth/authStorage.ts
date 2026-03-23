const TOKEN_KEY = "geox_ao_act_token";
const DEFAULT_AO_ACT_TOKEN = "geox_dev_MqF24b9NHfB6AkBNjKaxP_T0CnL0XZykhdmSyoQvg4";

export function readSessionToken(): string {
  try {
    const local = localStorage.getItem(TOKEN_KEY);
    if (typeof local === "string" && local.trim()) return local.trim();
  } catch {
    // ignore storage failures
  }

  try {
    const session = sessionStorage.getItem(TOKEN_KEY);
    if (typeof session === "string" && session.trim()) return session.trim();
  } catch {
    // ignore storage failures
  }

  return DEFAULT_AO_ACT_TOKEN;
}

export function persistSessionToken(nextToken: string): string {
  const token = String(nextToken ?? "").trim() || DEFAULT_AO_ACT_TOKEN;
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
  return token;
}

export function clearSessionToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
}
