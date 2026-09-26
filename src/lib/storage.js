// localStorage that never throws (private browsing, blocked storage, quota errors).
export const storage = {
  get(key, fallback = null) {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  getJson(key, fallback) {
    const raw = storage.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  setJson(key, value) {
    storage.set(key, JSON.stringify(value));
  },
};

export const session = {
  getJson(key, fallback) {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  setJson(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
