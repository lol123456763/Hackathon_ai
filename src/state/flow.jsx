// Holds the in-progress answers between the home page and the question wizard.
// Kept in sessionStorage so a refresh does not lose answers; cleared on "Start over".
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { session, storage } from '@/lib/storage';

const KEY = 'bb.flow';
const LAST_PLAN = 'bb.lastPlan';

export const EMPTY_PROFILE = {
  zip: '',
  household_size: null,
  children_count: null,
  child_under_5: null,
  income_range: null,
  situations: [],
  needs: [],
  urgency: null,
};

const FlowContext = createContext(null);

export function FlowProvider({ children }) {
  const [state, setState] = useState(() => session.getJson(KEY, { profile: EMPTY_PROFILE, prefilled: [], crisis: false }));

  const update = useCallback((patch) => {
    setState((s) => {
      const next = { ...s, ...patch, profile: { ...s.profile, ...(patch.profile || {}) } };
      session.setJson(KEY, next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    session.remove(KEY);
    setState({ profile: EMPTY_PROFILE, prefilled: [], crisis: false });
  }, []);

  const value = useMemo(() => ({ ...state, update, reset }), [state, update, reset]);
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useFlow must be used inside <FlowProvider>');
  return ctx;
}

export const lastPlan = {
  get: () => storage.getJson(LAST_PLAN, null),
  set: (token, created) => storage.setJson(LAST_PLAN, { token, created }),
  clear: () => storage.remove(LAST_PLAN),
};
