// In-progress neighbor answers between "Get help", the follow-up questions and plan creation.
// Kept in sessionStorage so a refresh does not lose answers. Never stores the typed text.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { session } from '@/lib/storage';

const KEY = 'loop.flow';

export const EMPTY_PROFILE = {
  zip: '',
  household_size: null,
  children_count: null,
  child_under_5: null,
  income_range: null,
  situations: [],
  needs: [],
  urgency: null,
  food_prefs: [],
};

const EMPTY = { profile: EMPTY_PROFILE, prefilled: [], crisis: false, fromText: false, understood: null, detectedLanguage: null };
const FlowContext = createContext(null);

export function FlowProvider({ children }) {
  const [state, setState] = useState(() => ({ ...EMPTY, ...session.getJson(KEY, {}) }));

  const update = useCallback((patch) => {
    setState((s) => {
      const next = { ...s, ...patch, profile: { ...s.profile, ...(patch.profile || {}) } };
      session.setJson(KEY, next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    session.remove(KEY);
    setState(EMPTY);
  }, []);

  const value = useMemo(() => ({ ...state, update, reset }), [state, update, reset]);
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useFlow must be used inside <FlowProvider>');
  return ctx;
}
