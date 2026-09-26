// Global app state: current role + demo identity, the neighbor's private plan token, demo helpers,
// the live neighborhood snapshot (polled every 2.5 s), and toasts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/api/backend';
import { storage } from '@/lib/storage';
import { useI18n } from '@/i18n';

const AppContext = createContext(null);
const POLL_MS = 3000;

const DEFAULT_IDENTITIES = { neighbor: 'me', give: 'maple-masa', volunteer: 'jordan', hub: 'riverside-fridge' };

export function AppProvider({ children }) {
  const { t, lang } = useI18n();
  const [role, setRoleState] = useState(() => storage.get('loop.role') || 'neighbor');
  const [identities, setIdentities] = useState(() => ({ ...DEFAULT_IDENTITIES, ...storage.getJson('loop.identities', {}) }));
  const [token, setTokenState] = useState(() => storage.get('loop.token'));
  const [hideHelpers, setHideHelpers] = useState(() => storage.get('loop.hideHelpers') === '1');
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState(false);
  const [toasts, setToasts] = useState([]);
  const inflight = useRef(false);
  const params = useRef({});
  params.current = { role, identity: identities[role], token };

  const toast = useCallback((message, variant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((x) => [...x.slice(-2), { id, message, variant }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3500);
  }, []);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const s = await api.call('state', params.current);
      setLive(s);
      setLiveError(false);
    } catch {
      setLiveError(true);
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onStorage = (e) => e.key === 'loop.local.db.v1' && refresh();
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(id);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  // Re-fetch immediately when the viewer changes.
  useEffect(() => {
    refresh();
  }, [role, identities, token, refresh]);

  const setRole = useCallback((r) => {
    storage.set('loop.role', r);
    setRoleState(r);
  }, []);

  const setIdentity = useCallback((r, key) => {
    setIdentities((ids) => {
      const next = { ...ids, [r]: key };
      storage.setJson('loop.identities', next);
      return next;
    });
  }, []);

  const setToken = useCallback((tk) => {
    if (tk) storage.set('loop.token', tk);
    else storage.remove('loop.token');
    setTokenState(tk || null);
  }, []);

  const errorMessage = useCallback(
    (e) => {
      if (!(e instanceof ApiError)) return t('errors.generic');
      if (e.code === 'network_error') return t('errors.network');
      if (e.code === 'not_eligible') return t('errors.not_eligible', { reasons: (e.extra?.reasons || []).map((r) => t(`vol.reasons.${r}`)).join(' · ') });
      if (e.code === 'too_young') return t('errors.too_young', { age: e.extra?.min_age });
      const msg = t(`errors.${e.code}`);
      return msg === `errors.${e.code}` ? t('errors.generic') : msg;
    },
    [t],
  );

  /** Run an action; shows a friendly toast on error and refreshes the live state. */
  const act = useCallback(
    async (action, args, { silent = false } = {}) => {
      try {
        const out = await api.call(action, args);
        refresh();
        return out;
      } catch (e) {
        if (!silent) toast(errorMessage(e), 'danger');
        throw e;
      }
    },
    [refresh, toast, errorMessage],
  );

  const resetDemo = useCallback(async () => {
    await api.call('reset', {});
    setToken(null);
    storage.remove('loop.flow');
    try {
      window.sessionStorage.removeItem('loop.flow');
    } catch {
      /* ignore */
    }
    await refresh();
    toast(t('demo.resetDone'), 'success');
  }, [refresh, setToken, toast, t]);

  const toggleHelpers = useCallback(() => {
    setHideHelpers((h) => {
      storage.set('loop.hideHelpers', h ? '0' : '1');
      return !h;
    });
  }, []);

  const value = useMemo(
    () => ({ role, setRole, identities, identity: identities[role], setIdentity, token, setToken, hideHelpers, toggleHelpers, live, liveError, refresh, act, toast, toasts, resetDemo, errorMessage, lang }),
    [role, setRole, identities, setIdentity, token, setToken, hideHelpers, toggleHelpers, live, liveError, refresh, act, toast, toasts, resetDemo, errorMessage, lang],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
