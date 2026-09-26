import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, MicOff, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { useFlow, EMPTY_PROFILE } from '@/state/flow';
import { useVoiceInput } from '@/lib/speech';
import { CATEGORY_META, CATEGORIES } from '@/lib/categories';
import { LIMITS } from '@shared/constants.js';
import { lookupZip } from '@shared/zip.js';
import { EXAMPLE_TEXT } from '@shared/golden.js';
import { Alert, Button, Card, Textarea, cn } from '@/components/ui';
import CrisisPanel from '@/components/CrisisPanel';
import PlanLoading from '@/components/PlanLoading';

const PROFILE_KEYS = ['zip', 'household_size', 'children_count', 'child_under_5', 'income_range', 'urgency'];

/** Which follow-up questions are still needed after a typed description. */
export function missingSteps(p) {
  const out = [];
  if (!lookupZip(p.zip).valid) out.push('zip');
  if (!p.household_size) out.push('household');
  if (p.children_count == null) out.push('children');
  if (!p.needs?.length) out.push('needs');
  if (!p.urgency) out.push('urgency');
  return out;
}

export default function GetHelp() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { act, setToken, token, hideHelpers } = useApp();
  const flow = useFlow();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [crisis, setCrisis] = useState(null);
  const voice = useVoiceInput({ lang, onText: (s) => setText(s.slice(0, LIMITS.situationText)) });

  async function createAndGo(profile, extra) {
    setCreating(true);
    try {
      const view = await act('createPlan', { profile, language: lang });
      setToken(view.token);
      flow.update({ ...extra, lastToken: view.token });
      navigate(`/p/${view.token}`, { state: { fresh: true } });
    } catch {
      setCreating(false);
    }
  }

  async function build(input) {
    const value = (input ?? text).trim();
    if (!value) {
      setError(t('help.empty'));
      return;
    }
    setError(null);
    setBusy(true);
    voice.stop();
    try {
      const ex = await act('extract', { text: value });
      const profile = { ...EMPTY_PROFILE };
      const prefilled = [];
      for (const k of PROFILE_KEYS) {
        if (ex[k] !== null && ex[k] !== undefined && ex[k] !== '') {
          profile[k] = ex[k];
          prefilled.push(k);
        }
      }
      profile.situations = ex.situations || [];
      profile.needs = [...new Set([...(ex.needs || []), ...picked])];
      profile.food_prefs = ex.food_prefs || [];
      const understood = { summary_en: ex.understood_summary_en || null, summary_es: ex.understood_summary_es || null, ai: ex.source !== 'rules' };
      flow.reset();
      const state = { profile, prefilled, crisis: !!ex.crisis_flag, fromText: true, understood, detectedLanguage: ex.detected_language };
      flow.update(state);
      if (ex.crisis_flag) {
        setCrisis(state);
      } else if (missingSteps(profile).length) {
        navigate('/help/questions');
      } else {
        await createAndGo(profile, { understood, detectedLanguage: ex.detected_language });
      }
    } catch {
      /* toast shown by act */
    } finally {
      setBusy(false);
    }
  }

  function continueWithCategories() {
    if (!picked.length) {
      setError(t('help.empty'));
      return;
    }
    flow.reset();
    flow.update({ profile: { ...EMPTY_PROFILE, needs: picked }, prefilled: ['needs'], fromText: false });
    navigate('/help/questions');
  }

  if (creating) return <PlanLoading />;
  if (crisis) {
    return (
      <div className="pt-2">
        <CrisisPanel
          onContinue={() => {
            setCrisis(null);
            flow.update({ crisis: false });
            navigate('/help/questions');
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {token && (
        <Alert title={t('help.resume')} action={<Button as={Link} to={`/p/${token}`} size="sm">{t('help.resumeCta')}</Button>} />
      )}
      <div>
        <h1 className="font-display text-[1.6rem] font-extrabold leading-tight tracking-tight">{t('help.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('help.subtitle')}</p>
      </div>

      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            build();
          }}
        >
          <label htmlFor="situation" className="font-semibold">
            {t('help.label')}
          </label>
          <Textarea
            id="situation"
            rows={5}
            className="mt-2"
            value={text}
            maxLength={LIMITS.situationText}
            placeholder={t('help.placeholder')}
            aria-describedby="situation-hint"
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p id="situation-hint" className="text-xs text-muted-foreground">
              {t('help.hint')}
            </p>
            {voice.supported && (
              <Button variant={voice.listening ? 'danger' : 'ghost'} size="sm" onClick={voice.listening ? voice.stop : voice.start} aria-pressed={voice.listening}>
                {voice.listening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                {voice.listening ? t('help.voiceStop') : t('help.voice')}
              </Button>
            )}
          </div>
          {voice.listening && <p className="mt-1 text-sm font-semibold text-danger" role="status">{t('help.voiceListening')}</p>}
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="accent" size="lg" className="mt-3 w-full" loading={busy}>
            {busy ? t('help.reading') : t('help.build')} {!busy && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
          </Button>
          {!hideHelpers && (
            <div className="mt-2 flex justify-center gap-4 text-sm font-semibold">
              <button type="button" disabled={busy} lang="en" className="py-2 text-primary underline-offset-4 hover:underline" onClick={() => { setText(EXAMPLE_TEXT.en); build(EXAMPLE_TEXT.en); }}>
                {t('help.exampleEn')}
              </button>
              <span className="py-2 text-muted-foreground" aria-hidden="true">·</span>
              <button type="button" disabled={busy} lang="es" className="py-2 text-primary underline-offset-4 hover:underline" onClick={() => { setText(EXAMPLE_TEXT.es); build(EXAMPLE_TEXT.es); }}>
                {t('help.exampleEs')} (Español)
              </button>
            </div>
          )}
        </form>
      </Card>

      <section aria-labelledby="pick-title">
        <h2 id="pick-title" className="text-center text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t('help.or')}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {CATEGORIES.map((cat) => {
            const { icon: Icon, tint } = CATEGORY_META[cat];
            const on = picked.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setError(null);
                  setPicked((p) => (p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]));
                }}
                className={cn('relative flex min-h-[64px] items-center gap-2 rounded-2xl border bg-card p-3 text-left text-sm font-semibold shadow-soft transition hover:shadow-lift', on && 'border-primary ring-2 ring-primary')}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tint)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="leading-tight">{t(`categories.${cat}`)}</span>
                {on && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" strokeWidth={3} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <Button className="mt-3 w-full" onClick={continueWithCategories} disabled={!picked.length}>
          {picked.length ? t('help.continueCount', { count: picked.length }) : t('help.continue')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Button>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {t('q.privacy')}
        </p>
      </section>
    </div>
  );
}
