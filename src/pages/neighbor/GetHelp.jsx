import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, MicOff, ArrowRight, ArrowUpRight, Check, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { useFlow, EMPTY_PROFILE } from '@/state/flow';
import { useVoiceInput } from '@/lib/speech';
import { CATEGORIES } from '@/lib/categories';
import { LIMITS } from '@shared/constants.js';
import { lookupZip } from '@shared/zip.js';
import { EXAMPLE_TEXT } from '@shared/golden.js';
import { Alert, Button, Textarea, cn } from '@/components/ui';
import CrisisPanel from '@/components/CrisisPanel';
import { JourneyArt } from '@/components/decor';

import PlanLoading from '@/components/PlanLoading';

// BenefitBridge's need tiles: five pastel cuts that tilt and sit at slightly different heights.
const TILE_SHAPES = [
  { cls: 'bg-tile-1 border-[#bad1b9] dark:border-border', angle: '-2deg', y: '0px', radius: '37px 21px 32px 17px / 24px 36px 19px 31px' },
  { cls: 'bg-tile-2 border-[#e9c6ae] dark:border-border', angle: '2deg', y: '10px', radius: '21px 36px 17px 40px / 36px 23px 38px 20px' },
  { cls: 'bg-tile-3 border-[#d2c9e6] dark:border-border', angle: '-1deg', y: '4px', radius: '44px 19px 36px 20px / 20px 40px 24px 33px' },
  { cls: 'bg-tile-4 border-[#ead69a] dark:border-border', angle: '2.5deg', y: '14px', radius: '18px 39px 26px 40px / 32px 22px 37px 25px' },
  { cls: 'bg-tile-5 border-[#b7d6c9] dark:border-border', angle: '-2.5deg', y: '6px', radius: '40px 22px 42px 14px / 22px 40px 25px 42px' },
];
const GLYPHS = { food: '◒', housing: '⌂', utilities: 'ϟ', healthcare: '✚', school_childcare: '▤', employment: '▣', transportation: '⇄', cash_assistance: '$', legal: '⚖', mental_health: '♡' };

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
    <div className="hero-wash -mx-4 px-4 pb-4 pt-2 sm:-mx-6 sm:px-6">
      {token && (
        <Alert className="mb-6" title={t('help.resume')} action={<Button as={Link} to={`/p/${token}`} size="sm">{t('help.resumeCta')}</Button>} />
      )}

      {/* Hero: words and the form on the left, the neighborhood note on the right (stacks on phones). */}
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.06fr)_minmax(300px,0.8fr)] lg:gap-14">
        <div>
          <p className="eyebrow mb-6">{t('help.eyebrow')}</p>
          <h1 className="mb-5 font-display text-[2.7rem] font-semibold leading-[1] tracking-[-0.06em] sm:text-6xl xl:text-[5.4rem]">
            <span className="block animate-phrase-arrive">{t('help.lead')}</span>
            <span className="italic-accent underline-draw block w-fit animate-phrase-arrive [animation-delay:180ms]">{t('help.accent')}</span>
          </h1>
          <p className="mb-7 max-w-xl text-lg leading-relaxed text-muted-foreground">{t('help.subtitle')}</p>

          <form
            className="cut-1 relative max-w-[650px] -rotate-1 border-2 border-[#a5bdaa] bg-card p-5 shadow-offset-lg transition-transform duration-300 focus-within:rotate-0 hover:rotate-0 dark:border-border sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              build();
            }}
          >
            <span className="absolute -top-7 right-5 rotate-12 text-5xl leading-none text-[#e79c77]" aria-hidden="true">✳</span>
            <label htmlFor="situation" className="font-bold">
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
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button type="submit" variant="accent" size="lg" className="w-full sm:w-auto" loading={busy}>
                {busy ? t('help.reading') : t('help.build')} {!busy && <ArrowUpRight className="h-5 w-5" aria-hidden="true" />}
              </Button>
              {!hideHelpers && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
                  <Button variant="link" disabled={busy} lang="en" onClick={() => { setText(EXAMPLE_TEXT.en); build(EXAMPLE_TEXT.en); }}>
                    {t('help.exampleEn')}
                  </Button>
                  <Button variant="link" disabled={busy} lang="es" onClick={() => { setText(EXAMPLE_TEXT.es); build(EXAMPLE_TEXT.es); }}>
                    {t('help.exampleEs')} (Español)
                  </Button>
                </div>
              )}
            </div>
          </form>

          <ul className="mt-6 flex flex-wrap gap-2.5 text-sm font-bold text-[#2d5b4a] dark:text-foreground">
            <li className="cut-chip -rotate-[1.5deg] bg-tile-1 px-3 py-1.5">
              <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />
              {t('help.trustPrivate')}
            </li>
            <li className="cut-chip rotate-[1.5deg] bg-tile-2 px-3 py-1.5">{t('help.trustLang')}</li>
            <li className="cut-chip -rotate-2 bg-tile-3 px-3 py-1.5">{t('help.trustFree')}</li>
          </ul>
        </div>

        {/* The neighborhood note, with BenefitBridge's journey art */}
        <aside className="relative mx-auto w-full max-w-[620px] -rotate-2 lg:translate-y-8 lg:rotate-3">
          <div className="absolute left-[12%] top-[15%] -z-10 h-[90%] w-[90%] bg-[#f2b99d] dark:bg-[#8d5c50]" style={{ borderRadius: '36% 64% 49% 51% / 57% 39% 61% 43%' }} aria-hidden="true" />
          <div
            className="flex min-h-[220px] flex-row items-center overflow-hidden border-2 border-[#1f5147] bg-[#255c4e] text-[#f4f4e9] shadow-[13px_17px_0_rgba(100,128,92,0.2)] lg:min-h-[540px] lg:flex-col lg:items-stretch lg:justify-between"
            style={{ borderRadius: '97px 48px 85px 58px / 62px 91px 58px 97px' }}
          >
            <JourneyArt className="min-h-[200px] w-[42%] lg:min-h-[320px] lg:w-full" />
            <div className="flex-1 p-5 pl-1 lg:px-11 lg:pb-12">
              <p className="mb-3 inline-block -rotate-3 rounded-[15px_10px_17px_8px] bg-[#f8d994] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#203f38] lg:text-xs">{t('help.noteTag')}</p>
              <h2 className="font-display text-2xl font-semibold italic leading-[1.02] tracking-[-0.04em] text-[#fffbee] lg:text-5xl">{t('help.noteTitle')}</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#e6f3e6] lg:mt-4 lg:text-base">{t('help.noteBody')}</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Needs */}
      <section aria-labelledby="pick-title" className="relative mt-20 pt-6 lg:mt-28">
        <div className="wavy-rule absolute -top-3 left-[1%] w-[96%]" aria-hidden="true" />
        <div className="mb-7 flex -rotate-1 items-baseline gap-4">
          <span className="section-index" aria-hidden="true">02 /</span>
          <h2 id="pick-title" className="font-display text-3xl font-semibold italic tracking-[-0.04em] sm:text-4xl">
            {t('help.or')}
          </h2>
        </div>
        <div className="grid grid-cols-2 items-start gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5 lg:grid-cols-5">
          {CATEGORIES.map((cat, i) => {
            const on = picked.includes(cat);
            const s = TILE_SHAPES[i % 5];
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setError(null);
                  setPicked((p) => (p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]));
                }}
                style={{ '--a': s.angle, '--y': s.y, borderRadius: s.radius }}
                className={cn(
                  'group relative grid min-h-[124px] translate-y-[var(--y)] rotate-[var(--a)] grid-cols-[1fr_auto] grid-rows-[auto_1fr] gap-x-2.5 gap-y-1.5 border-2 p-3.5 text-left transition-[transform,box-shadow] duration-300 [transition-timing-function:cubic-bezier(.18,1.4,.4,1)] hover:z-10 hover:-translate-y-2 hover:rotate-0 hover:scale-[1.03] sm:min-h-[150px] sm:p-4',
                  s.cls,
                  on ? 'border-primary shadow-[6px_8px_0_#edbd8d]' : 'shadow-[5px_6px_0_rgba(69,107,76,0.13)]',
                )}
              >
                <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#4d7964] dark:text-[#cce9be]" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="cut-blob row-span-2 flex h-9 w-9 rotate-[9deg] items-center justify-center border border-[rgba(48,99,76,0.25)] bg-white/60 text-lg transition-transform duration-300 group-hover:-rotate-[16deg] group-hover:scale-110 dark:bg-white/10 sm:h-11 sm:w-11 sm:text-2xl" aria-hidden="true">
                  {GLYPHS[cat]}
                </span>
                <span className="self-end font-bold leading-snug sm:text-[17px]">{t(`categories.${cat}`)}</span>
                {on && (
                  <span className="cut-blob absolute bottom-2 right-2.5 flex h-6 w-6 items-center justify-center bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Button onClick={continueWithCategories} disabled={!picked.length} size="lg">
            {picked.length ? t('help.continueCount', { count: picked.length }) : t('help.continue')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" /> {t('q.privacy')}
          </p>
        </div>
      </section>
    </div>
  );
}
