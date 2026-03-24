const EXPERT_KEY = "geox_expert";

export function readExpertModeFromStorage(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("expert") === "1") {
      localStorage.setItem(EXPERT_KEY, "1");
      return true;
    }
    return localStorage.getItem(EXPERT_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistExpertMode(next: boolean): void {
  try {
    if (next) localStorage.setItem(EXPERT_KEY, "1");
    else localStorage.removeItem(EXPERT_KEY);
  } catch {
    // ignore persistence errors
  }
}
