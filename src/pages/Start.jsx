import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Minus, Plus, Info, MapPin, Pencil, ShieldCheck } from 'lucide-react';
import { useI18n, joinList } from '@/i18n';
import { api } from '@/api/backend';
import { useFlow, lastPlan } from '@/state/flow';
import { lookupZip } from '@shared/zip.js';
import { SITUATIONS, INCOME_RANGES, URGENCIES } from '@shared/constants.js';
import { CATEGORIES, CATEGORY_META } from '@/lib/categories';
import { Alert, Button, Card, CheckItem, Input, cn } from '@/components/ui';
import CrisisPanel from '@/components/CrisisPanel';
import PlanLoading from '@/components/PlanLoading';

const STEPS = ['zip', 'household', 'children', 'income', 'situations', 'needs', 'urgency'];
const STEP_KEYS = {
  zip: ['zip'],
  household: ['household_size'],
  children: ['children_count'],
  income: ['income_range'],
  situations: ['situations'],
  needs: ['needs'],
  urgency: ['urgency'],
};

function Stepper({ value, onChange, min, max, label, t }) {
  const v = value ?? min;
  return (
    <div className="flex items-center gap-4" role="group" aria-label={label}>
      <Button variant="outline" size="icon" onClick={() => onChange(Math.max(min, v - 1))} disabled={v <= min} aria-label={t('wizard.decrease')}>
        <Minus className="h-5 w-5" aria-hidden="true" />
      </Button>
      <output aria-live="polite" className="min-w-[4ch] text-center font-display text-5xl font-bold">
        {v >= max ? `${max}+` : v}
      </output>
      <Button variant="outline" size="icon" onClick={() => onChange(Math.min(max, v + 1))} disabled={v >= max} aria-label={t('wizard.increase')}>
        <Plus className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );
}

function RadioList({ name, options, value, onChange }) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {options.map(([id, label]) => (
        <label
          key={id}
          className={cn(
            'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 transition hover:bg-muted/60',
            value === id && 'border-primary bg-primary-soft/60 ring-1 ring-primary',
          )}
        >
          <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
          <span className="font-medium">{label}</span>
        </label>
      ))}
    </div>
  );
}

export default function Start() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const flow = useFlow();
  const { profile } = flow;
  const [showCrisis, setShowCrisis] = useState(flow.crisis);

  // With a typed description, only ask for what we could not understand; always end on review.
  const steps = useMemo(() => {
    if (!flow.fromText) return STEPS;
    const pre = new Set(flow.prefilled);
    return STEPS.filter((s) => s === 'zip' ? !(pre.has('zip') && lookupZip(profile.zip).valid) : !STEP_KEYS[s].every((k) => pre.has(k)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.fromText]);

  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(steps.length === 0);
  const [zipTouched, setZipTouched] = useState(false);
  const [needsError, setNeedsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const headingRef = useRef(null);

  const step = reviewing ? 'review' : steps[index];
  const place = lookupZip(profile.zip);
  const zipOk = place.valid;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const set = (patch) => flow.update({ profile: patch });

  function next() {
    if (step === 'zip' && !zipOk) {
      setZipTouched(true);
      return;
    }
    if (step === 'needs' && !profile.needs.length) {
      setNeedsError(true);
      return;
    }
    // "Next" confirms the value shown on the stepper (Skip leaves it unanswered).
    if (step === 'household' && profile.household_size == null) set({ household_size: 1 });
    if (step === 'children' && profile.children_count == null) set({ children_count: 0, child_under_5: false });
    if (index < steps.length - 1) setIndex(index + 1);
    else setReviewing(true);
  }

  function back() {
    if (reviewing) {
      if (steps.length) setReviewing(false);
      else navigate('/');
      return;
    }
    if (index === 0) navigate('/');
    else setIndex(index - 1);
  }

  function editStep(s) {
    const i = STEPS.indexOf(s);
    // Allow editing any question from review, even ones that were prefilled.
    if (!steps.includes(s)) {
      flow.update({ fromText: false });
      setIndex(i);
    } else {
      setIndex(steps.indexOf(s));
    }
    setReviewing(false);
  }

  async function submit() {
    if (!zipOk) {
      editStep('zip');
      setZipTouched(true);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const view = await api.createPlan(profile, lang);
      lastPlan.set(view.token, view.created_date || new Date().toISOString());
      navigate(`/plan/${view.token}`, { state: { view, fresh: true } });
    } catch (e) {
      setError(e?.code === 'network_error' ? t('common.networkError') : t('common.error'));
      setSubmitting(false);
    }
  }

  if (showCrisis) {
    return (
      <div className="container-page max-w-3xl py-8">
        <CrisisPanel
          onContinue={() => {
            setShowCrisis(false);
            flow.update({ crisis: false });
          }}
        />
      </div>
    );
  }

  if (submitting) return <PlanLoading />;

  const total = steps.length;
  const current = Math.min(index + 1, total);
  const progress = reviewing ? 100 : total ? Math.round((index / total) * 100) : 100;

  const why = (key) => (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-muted/70 p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        <span className="font-semibold text-foreground">{t('wizard.whyWeAsk')}: </span>
        {t(key)}
      </span>
    </p>
  );

  const titleFor = {
    zip: t('wizard.zipTitle'),
    household: t('wizard.householdTitle'),
    children: t('wizard.childrenTitle'),
    income: t('wizard.incomeTitle'),
    situations: t('wizard.situationsTitle'),
    needs: t('wizard.needsTitle'),
    urgency: t('wizard.urgencyTitle'),
    review: t('wizard.review'),
  };

  const answerText = {
    zip: profile.zip ? `${profile.zip}${place.county ? ` · ${t('wizard.zipFound', { county: place.county })}` : ''}` : null,
    household: profile.household_size ? String(profile.household_size) : null,
    children:
      profile.children_count !== null && profile.children_count !== undefined
        ? `${profile.children_count}${profile.child_under_5 ? ` · ${t('wizard.under5')}` : ''}`
        : null,
    income: profile.income_range ? t(`income.${profile.income_range}`) : null,
    situations: profile.situations.length ? joinList(profile.situations.map((s) => t(`situations.${s}`)), lang) : null,
    needs: profile.needs.length ? joinList(profile.needs.map((c) => t(`categories.${c}`)), lang) : null,
    urgency: profile.urgency ? t(`urgency.${profile.urgency}`) : null,
  };

  return (
    <div className="container-page max-w-2xl py-6 sm:py-10">
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{reviewing ? t('wizard.review') : t('wizard.step', { current, total })}</span>
          <span>{t('wizard.title')}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {flow.fromText && flow.prefilled.length > 0 && (
        <Alert className="mb-4" variant="success">
          {t('wizard.prefilled')}
        </Alert>
      )}

      <Card className="animate-fade-up p-5 sm:p-7" key={step}>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold leading-snug focus:outline-none sm:text-3xl">
          {titleFor[step]}
        </h1>

        {step === 'zip' && (
          <div className="mt-5">
            <label htmlFor="zip" className="text-sm font-semibold">
              {t('wizard.zipLabel')}
            </label>
            <Input
              id="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              className="mt-1 max-w-[12rem] text-2xl tracking-widest"
              value={profile.zip}
              invalid={zipTouched && !zipOk}
              aria-describedby="zip-status"
              onChange={(e) => set({ zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
              onBlur={() => setZipTouched(true)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <div id="zip-status" className="mt-2 min-h-[1.5rem] text-sm" aria-live="polite">
              {zipTouched && !zipOk && <span className="font-medium text-danger">{t('wizard.zipError')}</span>}
              {zipOk && place.inTexas && place.county && (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <MapPin className="h-4 w-4" aria-hidden="true" /> {t('wizard.zipFound', { county: place.county })}
                </span>
              )}
              {zipOk && !place.inTexas && <span className="text-muted-foreground">{t('wizard.zipOutside')}</span>}
            </div>
            {why('wizard.zipWhy')}
          </div>
        )}

        {step === 'household' && (
          <div className="mt-6">
            <Stepper t={t} label={t('wizard.householdLabel')} value={profile.household_size ?? 1} min={1} max={10} onChange={(v) => set({ household_size: v })} />
            {why('wizard.householdWhy')}
          </div>
        )}

        {step === 'children' && (
          <div className="mt-6">
            <Stepper
              t={t}
              label={t('wizard.childrenLabel')}
              value={profile.children_count ?? 0}
              min={0}
              max={10}
              onChange={(v) => set({ children_count: v, ...(v === 0 ? { child_under_5: false } : {}), ...(profile.household_size !== null && profile.household_size <= v ? { household_size: v + 1 } : {}) })}
            />
            {(profile.children_count ?? 0) > 0 && (
              <CheckItem className="mt-5" checked={profile.child_under_5 === true} onChange={(c) => set({ child_under_5: c })}>
                {t('wizard.under5')}
              </CheckItem>
            )}
            {why('wizard.childrenWhy')}
          </div>
        )}

        {step === 'income' && (
          <div className="mt-5">
            <RadioList name="income" value={profile.income_range} onChange={(v) => set({ income_range: v })} options={INCOME_RANGES.map((r) => [r.id, t(`income.${r.id}`)])} />
            {why('wizard.incomeWhy')}
          </div>
        )}

        {step === 'situations' && (
          <div className="mt-5 grid gap-2">
            {SITUATIONS.map((s) => (
              <CheckItem
                key={s}
                checked={profile.situations.includes(s)}
                onChange={(c) => set({ situations: c ? [...profile.situations, s] : profile.situations.filter((x) => x !== s) })}
              >
                {t(`situations.${s}`)}
              </CheckItem>
            ))}
            {why('wizard.situationsWhy')}
          </div>
        )}

        {step === 'needs' && (
          <div className="mt-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map((c) => {
                const { icon: Icon } = CATEGORY_META[c];
                return (
                  <CheckItem
                    key={c}
                    checked={profile.needs.includes(c)}
                    onChange={(on) => {
                      setNeedsError(false);
                      set({ needs: on ? [...profile.needs, c] : profile.needs.filter((x) => x !== c) });
                    }}
                    description={t(`categoryHints.${c}`)}
                  >
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {t(`categories.${c}`)}
                    </span>
                  </CheckItem>
                );
              })}
            </div>
            {needsError && (
              <p role="alert" className="mt-3 font-medium text-danger">
                {t('wizard.needsError')}
              </p>
            )}
            {why('wizard.needsWhy')}
          </div>
        )}

        {step === 'urgency' && (
          <div className="mt-5">
            <RadioList name="urgency" value={profile.urgency} onChange={(v) => set({ urgency: v })} options={URGENCIES.map((u) => [u, t(`urgency.${u}`)])} />
            {why('wizard.urgencyWhy')}
          </div>
        )}

        {step === 'review' && (
          <div className="mt-5">
            <dl className="divide-y rounded-xl border">
              {STEPS.map((s) => (
                <div key={s} className="flex items-start justify-between gap-3 p-3 sm:p-4">
                  <div className="min-w-0">
                    <dt className="text-sm text-muted-foreground">{titleFor[s]}</dt>
                    <dd className={cn('font-medium', !answerText[s] && 'text-muted-foreground italic')}>{answerText[s] || t('wizard.notAnswered')}</dd>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => editStep(s)} aria-label={`${t('wizard.edit')}: ${titleFor[s]}`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" /> {t('wizard.edit')}
                  </Button>
                </div>
              ))}
            </dl>
            {!zipOk && (
              <p role="alert" className="mt-3 font-medium text-danger">
                {t('wizard.zipError')}
              </p>
            )}
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {t('wizard.privacyNote')}
            </p>
          </div>
        )}

        {error && (
          <Alert variant="danger" className="mt-5">
            {error}
          </Alert>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={back}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" /> {t('wizard.back')}
          </Button>
          <div className="flex gap-2">
            {step !== 'zip' && step !== 'review' && step !== 'needs' && (
              <Button variant="outline" onClick={() => (index < steps.length - 1 ? setIndex(index + 1) : setReviewing(true))}>
                {t('wizard.skip')}
              </Button>
            )}
            {step === 'review' ? (
              <Button variant="accent" size="lg" onClick={submit}>
                {t('wizard.finish')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={next}>
                {t('wizard.next')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </Card>
      <p className="mt-4 text-center text-sm">
        <Link to="/browse" className="text-muted-foreground underline-offset-4 hover:underline">
          {t('nav.browse')}
        </Link>
      </p>
    </div>
  );
}
