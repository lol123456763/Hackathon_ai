import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Sparkles, ArrowRight, ShieldCheck, MessageSquareText, ListChecks, Route, Check } from 'lucide-react';
import { useI18n, formatDate } from '@/i18n';
import { api } from '@/api/backend';
import { useFlow, lastPlan, EMPTY_PROFILE } from '@/state/flow';
import { useVoiceInput } from '@/lib/speech';
import { CATEGORIES, CATEGORY_META } from '@/lib/categories';
import { LIMITS } from '@shared/constants.js';
import STATS from '@data/stats.json';
import { Alert, Button, Card, Textarea, cn } from '@/components/ui';
import CrisisPanel from '@/components/CrisisPanel';

const PROFILE_KEYS = ['zip', 'household_size', 'children_count', 'child_under_5', 'income_range', 'urgency'];

export default function Home() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const flow = useFlow();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [crisis, setCrisis] = useState(false);
  const voice = useVoiceInput({ lang, onText: (s) => setText(s.slice(0, LIMITS.situationText)) });
  const saved = lastPlan.get();

  async function buildFromText(input) {
    const value = (input ?? text).trim();
    if (!value) {
      setError(t('home.emptyError'));
      return;
    }
    setError(null);
    setBusy(true);
    voice.stop();
    try {
      const ex = await api.extractSituation(value);
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
      if (profile.situations.length) prefilled.push('situations');
      if ((ex.needs || []).length) prefilled.push('needs');
      flow.reset();
      flow.update({ profile, prefilled, crisis: !!ex.crisis_flag, fromText: true });
      if (ex.detected_language && ex.detected_language !== lang) setLang(ex.detected_language);
      if (ex.crisis_flag) setCrisis(true);
      else navigate('/start');
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  function continueWithCategories() {
    if (!picked.length) {
      setError(t('home.emptyError'));
      return;
    }
    flow.reset();
    flow.update({ profile: { ...EMPTY_PROFILE, needs: picked }, prefilled: ['needs'], crisis: false, fromText: false });
    navigate('/start');
  }

  function toggle(cat) {
    setError(null);
    setPicked((p) => (p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]));
  }

  if (crisis) {
    return (
      <div className="container-page max-w-3xl py-8">
        <CrisisPanel onContinue={() => navigate('/start')} />
      </div>
    );
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary-soft/70 to-background">
        <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-semibold text-primary shadow-soft">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('home.eyebrow')}
            </p>
            <h1 className="mt-4 font-display text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">{t('home.title')}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t('home.subtitle')}</p>
            <ul className="mt-6 hidden gap-3 text-[15px] lg:grid">
              {[t('home.how1Title'), t('home.how2Title'), t('home.how3Title')].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-primary" aria-hidden="true" /> {s}
                </li>
              ))}
            </ul>
            <p className="mt-6 hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" /> {t('home.trust')}
            </p>
          </div>

          <Card className="animate-fade-up p-4 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                buildFromText();
              }}
            >
              <label htmlFor="situation" className="text-lg font-semibold">
                {t('home.describeLabel')}
              </label>
              <p id="situation-hint" className="mt-1 text-sm text-muted-foreground">
                {t('home.describeHint')}
              </p>
              <Textarea
                id="situation"
                rows={5}
                className="mt-3 min-h-[140px]"
                value={text}
                maxLength={LIMITS.situationText}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                placeholder={t('home.describePlaceholder')}
                aria-describedby="situation-hint situation-count"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                {voice.supported ? (
                  <Button variant={voice.listening ? 'danger' : 'soft'} size="sm" onClick={voice.listening ? voice.stop : voice.start} aria-pressed={voice.listening}>
                    {voice.listening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                    {voice.listening ? t('home.voiceStop') : t('home.voice')}
                  </Button>
                ) : (
                  <span />
                )}
                <span id="situation-count" className="text-xs text-muted-foreground">
                  {t('home.charCount', { count: text.length, max: LIMITS.situationText })}
                </span>
              </div>
              {voice.listening && (
                <p className="mt-2 text-sm font-medium text-danger" role="status">
                  {t('home.voiceListening')}
                </p>
              )}
              <Button type="submit" variant="accent" size="lg" className="mt-4 w-full" loading={busy}>
                {busy ? t('home.building') : t('home.build')}
                {!busy && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
              </Button>
              <button
                type="button"
                className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  const ex = t('home.exampleText');
                  setText(ex);
                  buildFromText(ex);
                }}
                disabled={busy}
              >
                {t('home.tryExample')}
              </button>
            </form>
          </Card>
        </div>
      </section>

      <section className="container-page py-10" aria-labelledby="choose-title">
        {saved?.token && (
          <Alert
            className="mb-8"
            title={t('home.resumeTitle')}
            action={
              <Button as={Link} to={`/plan/${saved.token}`} size="sm">
                {t('home.resumeCta')}
              </Button>
            }
          >
            {t('home.resumeBody', { date: formatDate(saved.created, lang) })}
          </Alert>
        )}
        <h2 id="choose-title" className="text-center text-xl font-semibold sm:text-2xl">
          {t('home.or')}
        </h2>
        <p className="mt-1 text-center text-muted-foreground">{t('home.chooseHint')}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((cat) => {
            const { icon: Icon, tint } = CATEGORY_META[cat];
            const on = picked.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(cat)}
                className={cn(
                  'group relative flex min-h-[112px] flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift',
                  on && 'border-primary ring-2 ring-primary',
                )}
              >
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tint)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-semibold leading-tight">{t(`categories.${cat}`)}</span>
                <span className="text-xs text-muted-foreground">{t(`categoryHints.${cat}`)}</span>
                {on && (
                  <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4 animate-pop" strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-center font-medium text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-center">
          <Button size="lg" onClick={continueWithCategories} disabled={!picked.length} className="w-full sm:w-auto">
            {picked.length ? t('home.continueCount', { count: picked.length }) : t('home.continue')}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <section className="border-y bg-card" aria-labelledby="how-title">
        <div className="container-page py-12">
          <h2 id="how-title" className="text-center font-display text-2xl font-bold sm:text-3xl">
            {t('home.howTitle')}
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              [MessageSquareText, t('home.how1Title'), t('home.how1')],
              [ListChecks, t('home.how2Title'), t('home.how2', { count: STATS.resources.toLocaleString() })],
              [Route, t('home.how3Title'), t('home.how3')],
            ].map(([Icon, title, body], i) => (
              <li key={title} className="rounded-2xl border bg-background p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-semibold text-primary">{i + 1}</p>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
          <dl className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              [STATS.resources.toLocaleString(), t('home.statPrograms')],
              [String(STATS.counties), t('home.statCounties')],
              ['EN · ES', t('home.statLanguages')],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-2xl font-bold text-primary sm:text-4xl">{v}</dd>
                <dd className="text-sm text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground lg:hidden">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {t('home.trust')}
          </p>
        </div>
      </section>
    </div>
  );
}
