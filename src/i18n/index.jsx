import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en';
import es from './es';
import { storage } from '@/lib/storage';

const DICTS = { en, es };
const LangContext = createContext(null);

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

export function format(template, params) {
  if (typeof template !== 'string' || !params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
}

function initialLanguage() {
  const saved = storage.get('loop.lang');
  if (saved === 'en' || saved === 'es') return saved;
  if (typeof navigator !== 'undefined' && /^es\b/i.test(navigator.language || '')) return 'es';
  return 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    storage.set('loop.lang', lang);
  }, [lang]);

  const setLang = useCallback((l) => setLangState(l === 'es' ? 'es' : 'en'), []);

  const t = useCallback(
    (key, params) => {
      const v = lookup(DICTS[lang], key) ?? lookup(en, key);
      if (v === undefined) {
        if (import.meta.env.DEV) console.warn(`Missing translation: ${key}`);
        return key;
      }
      return format(v, params);
    },
    [lang],
  );

  // Pick the right language field from a data record, e.g. field(resource, 'description').
  const field = useCallback(
    (obj, base) => {
      if (!obj) return '';
      return (lang === 'es' ? obj[`${base}_es`] : null) || obj[`${base}_en`] || obj[base] || '';
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, field }), [lang, setLang, t, field]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}

export function formatDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatMoney(n, lang) {
  return new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function joinList(items, lang) {
  try {
    return new Intl.ListFormat(lang === 'es' ? 'es' : 'en', { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}
