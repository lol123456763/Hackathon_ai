import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Minus, Plus, Info, MapPin } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { useFlow } from '@/state/flow';
import { lookupZip } from '@shared/zip.js';
import { SITUATIONS, INCOME_RANGES, URGENCIES } from '@shared/constants.js';
import { CATEGORIES, CATEGORY_META } from '@/lib/categories';
import { Alert, Button, Card, CheckItem, Input, cn } from '@/components/ui';
import PlanLoading from '@/components/PlanLoading';
import { missingSteps } from './GetHelp';

const ALL_STEPS = ['zip', 'household', 'children', 'income', 'situations', 'needs', 'urgency'];

function Stepper({ value, onChange, min, max, label, t }) {
  const v = value ?? min;
  return (
    <div className="flex items-center justify-center gap-5" role="group" aria-label={label}>
      <Button variant="outline" size="icon" onClick={() => onChange(Math.max(min, v - 1))} disabled={v <= min} aria-label={t('q.fewer')}>
        <Minus className="h-5 w-5" aria-hidden="true" />
      </Button>
      <output aria-live="polite" className="min-w-[3ch] text-center font-display text-5xl font-extrabold">
        {v >= max ? `${max}+` : v}
      </output>
      <Button variant="outline" size="icon" onClick={() => onChange(Math.min(max, v + 1))} disabled={v >= max} aria-label={t('q.more')}>
        <Plus className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );
}

function Radios({ name, options, value, onChange }) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {options.map(([id, label]) => (
        <label key={id} className={cn('flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 font-medium transition hover:bg-muted/60', value === id && 'border-primary bg-primary-soft ring-1 ring-primary')}>
          <input type="radio" name={name} checked={value === id} onChange={() => onChange(id)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
          {label}
        </label>
      ))}
    </div>
  );
}

export default function Questions() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { act, setToken } = useApp();
  const flow = useFlow();
  const { profile } = flow;
  // Only ask what we could not understand from a typed description (ZIP is always required).
  const steps = useMemo(() => (flow.fromText ? missingSteps(profile) : ALL_STEPS), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const [needsError, setNeedsError] = useState(false);
  const [creating, setCreating] = useState(false);
  const heading = useRef(null);
  const step = steps[index];
  const place = lookupZip(profile.zip);

  useEffect(() => heading.current?.focus(), [step]);
  useEffect(() => {
    if (!steps.length) navigate('/help', { replace: true });
  }, [steps.length, navigate]);

  const set = (patch) => flow.update({ profile: patch });

  async function finish() {
    setCreating(true);
    try {
      const view = await act('createPlan', { profile, language: lang });
      setToken(view.token);
      flow.update({ lastToken: view.token });
      navigate(`/p/${view.token}`, { state: { fresh: true }, replace: true });
    } catch {
      setCreating(false);
    }
  }

  function next() {
    if (step === 'zip' && !place.valid) {
      setTouched(true);
      return;
    }
    if (step === 'needs' && !profile.needs.length) {
      setNeedsError(true);
      return;
    }
    if (step === 'household' && profile.household_size == null) set({ household_size: 1 });
    if (step === 'children' && profile.children_count == null) set({ children_count: 0, child_under_5: false });
    if (index < steps.length - 1) setIndex(index + 1);
    else finish();
  }
  function skip() {
    if (index < steps.length - 1) setIndex(index + 1);
    else finish();
  }

  if (creating) return <PlanLoading />;
  if (!step) return null;

  const why = (k) => (
    <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        <span className="font-semibold text-foreground">{t('q.why')}: </span>
        {t(k)}
      </span>
    </p>
  );
  const pct = Math.round((index / steps.length) * 100);

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>{t('q.title')}</span>
        <span>{t('q.step', { current: index + 1, total: steps.length })}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%` }} />
      </div>
      {flow.fromText && flow.prefilled.length > 0 && (
        <Alert variant="success" className="mt-3">
          {t('q.prefilled')}
        </Alert>
      )}

      <Card className="mt-3 animate-fade-up p-5" key={step}>
        <h1 ref={heading} tabIndex={-1} className="text-xl font-extrabold leading-snug focus:outline-none">
          {t(`q.${step === 'children' ? 'kids' : step}`)}
        </h1>

        {step === 'zip' && (
          <div className="mt-4">
            <label htmlFor="zip" className="text-sm font-semibold">
              {t('q.zipLabel')}
            </label>
            <Input
              id="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              className="mt-1 text-center text-2xl font-bold tracking-[0.3em]"
              value={profile.zip}
              invalid={touched && !place.valid}
              aria-describedby="zip-status"
              onChange={(e) => set({ zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
              onBlur={() => profile.zip.length === 5 && setTouched(true)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <p id="zip-status" className="mt-2 min-h-[1.25rem] text-sm" aria-live="polite">
              {touched && !place.valid && <span className="font-medium text-danger">{t('q.zipError')}</span>}
              {place.valid && (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <MapPin className="h-4 w-4" aria-hidden="true" /> {place.county ? t('q.zipFound', { county: place.county, state: place.state }) : t('q.zipState', { state: place.state })}
                </span>
              )}
            </p>
            {why('q.zipWhy')}
          </div>
        )}

        {step === 'household' && (
          <div className="mt-6">
            <Stepper t={t} label={t('q.household')} value={profile.household_size ?? 1} min={1} max={10} onChange={(v) => set({ household_size: v })} />
            {why('q.householdWhy')}
          </div>
        )}

        {step === 'children' && (
          <div className="mt-6">
            <Stepper t={t} label={t('q.kids')} value={profile.children_count ?? 0} min={0} max={10} onChange={(v) => set({ children_count: v, ...(v === 0 ? { child_under_5: false } : {}) })} />
            {(profile.children_count ?? 0) > 0 && (
              <CheckItem className="mt-4" checked={profile.child_under_5 === true} onChange={(c) => set({ child_under_5: c })}>
                {t('q.under5')}
              </CheckItem>
            )}
            {why('q.kidsWhy')}
          </div>
        )}

        {step === 'income' && (
          <div className="mt-4">
            <Radios name="income" value={profile.income_range} onChange={(v) => set({ income_range: v })} options={INCOME_RANGES.map((r) => [r.id, t(`income.${r.id}`)])} />
            {why('q.incomeWhy')}
          </div>
        )}

        {step === 'situations' && (
          <div className="mt-4 grid gap-2">
            {SITUATIONS.map((s) => (
              <CheckItem key={s} checked={profile.situations.includes(s)} onChange={(c) => set({ situations: c ? [...profile.situations, s] : profile.situations.filter((x) => x !== s) })}>
                {t(`situations.${s}`)}
              </CheckItem>
            ))}
            {why('q.situationsWhy')}
          </div>
        )}

        {step === 'needs' && (
          <div className="mt-4">
            <div className="grid gap-2">
              {CATEGORIES.map((c) => {
                const Icon = CATEGORY_META[c].icon;
                return (
                  <CheckItem
                    key={c}
                    checked={profile.needs.includes(c)}
                    onChange={(on) => {
                      setNeedsError(false);
                      set({ needs: on ? [...profile.needs, c] : profile.needs.filter((x) => x !== c) });
                    }}
                  >
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {t(`categories.${c}`)}
                    </span>
                  </CheckItem>
                );
              })}
            </div>
            {needsError && (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                {t('q.needsError')}
              </p>
            )}
            {why('q.needsWhy')}
          </div>
        )}

        {step === 'urgency' && (
          <div className="mt-4">
            <Radios name="urgency" value={profile.urgency} onChange={(v) => set({ urgency: v })} options={URGENCIES.map((u) => [u, t(`urgency.${u}`)])} />
            {why('q.urgencyWhy')}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => (index === 0 ? navigate('/help') : setIndex(index - 1))}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" /> {t('q.back')}
          </Button>
          <div className="flex gap-2">
            {!['zip', 'needs'].includes(step) && (
              <Button variant="outline" onClick={skip}>
                {t('q.skip')}
              </Button>
            )}
            <Button variant={index === steps.length - 1 ? 'accent' : 'primary'} onClick={next}>
              {index === steps.length - 1 ? t('q.finish') : t('q.next')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>
      <p className="mt-3 text-center text-xs text-muted-foreground">{t('q.privacy')}</p>
    </div>
  );
}
