const PREFIX = "coach-nutrition:";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const storage = {
  get(key: string): string | null {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(PREFIX + key);
  },
  set(key: string, value: string) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(PREFIX + key, value);
  },
  remove(key: string) {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(PREFIX + key);
  },
  getJSON<T>(key: string, fallback: T): T {
    const raw = storage.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  setJSON(key: string, value: unknown) {
    storage.set(key, JSON.stringify(value));
  },
};
