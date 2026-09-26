import { useEffect, useMemo, useState } from 'react';
import { Utensils, Send, MapPin, ShieldCheck, Minus, Plus, Heart } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { hhmmLabel } from '@/lib/format';
import { EXAMPLE_NOTE } from '@shared/golden.js';
import { REQUEST_TYPES } from '@shared/constants.js';
import { AiTag, Sheet, StatusTracker } from './bits';
import LoopRing from './LoopRing';
import { Loopy } from './decor';
import { Alert, Button, Card, Chip, Textarea, cn } from './ui';

function RequestSheet({ open, onClose, token, defaultSize, defaultPrefs, onPosted }) {
  const { t, lang } = useI18n();
  const { act } = useApp();
  const [opts, setOpts] = useState(null);
  const [type, setType] = useState('food_tonight');
  const [size, setSize] = useState(defaultSize || 1);
  const [prefs, setPrefs] = useState(defaultPrefs?.length ? defaultPrefs : []);
  const [allergy, setAllergy] = useState('');
  const [hubKey, setHubKey] = useState(null);
  const [neededBy, setNeededBy] = useState('19:00');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    act('requestOptions', { token }, { silent: true })
      .then((o) => {
        setOpts(o);
        setHubKey(o.hubs[0]?.key || null);
        setSize(o.household_size || defaultSize || 1);
      })
      .catch(() => setOpts({ hubs: [] }));
  }, [open, token, act, defaultSize]);

  const hub = opts?.hubs.find((h) => h.key === hubKey);
  const times = useMemo(() => {
    const close = hub?.close || '20:00';
    return ['18:00', '18:30', '19:00', '19:30', '20:00'].filter((x) => x <= close);
  }, [hub]);
  useEffect(() => {
    if (times.length && !times.includes(neededBy)) setNeededBy(times.includes('19:00') ? '19:00' : times[times.length - 1]);
  }, [times, neededBy]);

  const togglePref = (p) => {
    if (p === 'none') return setPrefs([]);
    setPrefs((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  };

  async function post() {
    setBusy(true);
    try {
      const view = await act('postRequest', { token, type, household_size: size, food_prefs: prefs, allergy_note: allergy, hub_key: hubKey, needed_by: neededBy, language: lang });
      onPosted(view);
      onClose();
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  }

  const prefLabel = prefs.length ? ` · ${prefs.map((p) => t(`tonight.pref.${p}`).toLowerCase()).join(', ')}` : '';
  return (
    <Sheet open={open} onClose={onClose} title={t('tonight.sheetTitle')}>
      {!opts ? (
        <div className="skeleton h-40" />
      ) : !opts.hubs.length ? (
        <Alert variant="warning">{t('errors.no_hub_nearby')}</Alert>
      ) : (
        <div className="space-y-4">
          <p className="rounded-xl bg-primary-soft p-3 text-sm font-semibold text-primary">
            {t('tonight.summary', { type: t(`tonight.types.${type}`), count: size, hub: hub?.name || '', time: hhmmLabel(neededBy, lang) })}
            {prefLabel}
          </p>
          <fieldset>
            <legend className="text-sm font-semibold">{t('tonight.type')}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REQUEST_TYPES.map((x) => (
                <Chip key={x} selected={type === x} onClick={() => setType(x)}>
                  {t(`tonight.types.${x}`)}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t('tonight.familyOf', { count: size })}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSize((s) => Math.max(1, s - 1))} aria-label="−">
                <Minus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setSize((s) => Math.min(12, s + 1))} aria-label="+">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          {['food_tonight', 'groceries_week'].includes(type) && (
            <fieldset>
              <legend className="text-sm font-semibold">{t('tonight.prefs')}</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {['none', 'vegetarian', 'no_pork', 'halal', 'allergy'].map((p) => (
                  <Chip key={p} selected={p === 'none' ? !prefs.length : prefs.includes(p)} onClick={() => togglePref(p)}>
                    {t(`tonight.pref.${p}`)}
                  </Chip>
                ))}
              </div>
              {prefs.includes('allergy') && (
                <input
                  aria-label={t('tonight.allergyNote')}
                  placeholder={t('tonight.allergyNote')}
                  maxLength={80}
                  value={allergy}
                  onChange={(e) => setAllergy(e.target.value)}
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-input bg-card px-3"
                />
              )}
            </fieldset>
          )}
          <fieldset>
            <legend className="text-sm font-semibold">{t('tonight.hub')}</legend>
            <p className="text-xs text-muted-foreground">{t('tonight.hubHint')}</p>
            <div className="mt-1.5 grid gap-1.5">
              {opts.hubs.map((h) => (
                <label key={h.key} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', hubKey === h.key && 'border-primary bg-primary-soft')}>
                  <input type="radio" name="hub" checked={hubKey === h.key} onChange={() => setHubKey(h.key)} className="mt-1 h-5 w-5 accent-[hsl(var(--primary))]" />
                  <span className="text-sm">
                    <span className="block font-semibold">{h.name}</span>
                    <span className="text-muted-foreground">
                      <MapPin className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
                      {h.distance} {t('common.mi')} · {t('tonight.openUntil', { time: hhmmLabel(h.close, lang) })}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">
            {t('tonight.neededBy')}
            <select value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-xl border border-input bg-card px-3 font-normal">
              {times.map((x) => (
                <option key={x} value={x}>
                  {hhmmLabel(x, lang)}
                </option>
              ))}
            </select>
          </label>
          <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {t('tonight.privacy', { count: size })}
          </p>
          <Button variant="accent" size="lg" className="w-full" onClick={post} loading={busy} disabled={!hubKey}>
            <Send className="h-5 w-5" aria-hidden="true" /> {t('tonight.postAnon')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function ThankYou({ token }) {
  const { t, lang } = useI18n();
  const { act, hideHelpers } = useApp();
  const [text, setText] = useState('');
  const [state, setState] = useState('idle');
  async function send() {
    setState('sending');
    try {
      const r = await act('sendThanks', { token, text });
      setState(r.ok ? 'sent' : 'blocked');
    } catch {
      setState('idle');
    }
  }
  if (state === 'sent') return <p className="mt-3 flex items-center gap-2 font-semibold text-success"><Heart className="h-4 w-4" aria-hidden="true" /> {t('tonight.thanksSent')}</p>;
  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <label htmlFor="thanks" className="text-sm font-semibold">
          {t('tonight.thanksTitle')}
        </label>
        {!hideHelpers && (
          <button type="button" className="rounded-full border border-dashed border-accent px-2 py-0.5 text-xs font-bold text-accent" onClick={() => setText(EXAMPLE_NOTE[lang])}>
            {t('tonight.exampleNote')}
          </button>
        )}
      </div>
      <Textarea id="thanks" rows={2} maxLength={400} className="mt-1.5" value={text} placeholder={t('tonight.thanksPlaceholder')} onChange={(e) => setText(e.target.value)} />
      {state === 'blocked' && <p role="alert" className="mt-1 text-sm text-danger">{t('tonight.thanksBlocked')}</p>}
      <Button className="mt-2" size="sm" onClick={send} disabled={!text.trim()} loading={state === 'sending'}>
        <Heart className="h-4 w-4" aria-hidden="true" /> {t('tonight.thanksSend')}
      </Button>
    </div>
  );
}

export default function TonightCard({ view, request, onPlanChange }) {
  const { t, lang } = useI18n();
  const { act } = useApp();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justCovered, setJustCovered] = useState(false);
  const status = request?.status;

  // Play the loop-closing animation when the status flips to ready while the card is on screen.
  const [prev, setPrev] = useState(status);
  useEffect(() => {
    if (status === 'ready' && prev && prev !== 'ready') setJustCovered(true);
    setPrev(status);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const showAsk = !request && view.plan?.tonight?.show && view.tonight?.available;
  if (!request && !showAsk) return null;

  const covered = ['ready', 'picked_up'].includes(status);
  const hubName = request?.hub?.name || '';

  return (
    <section aria-labelledby="tonight-title" className="scroll-mt-20">
      <Card className={cn('overflow-hidden border-2 p-0', covered ? 'border-success/60' : 'border-accent/50')}>
        <div className={cn('flex items-center gap-3 px-4 py-3', covered ? 'bg-success-soft' : 'bg-accent-soft')}>
          <LoopRing size={44} closed={covered} animate={justCovered || covered} />
          <div className="min-w-0">
            {!covered && <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('plan.tonight')}</p>}
            <h2 id="tonight-title" className="text-lg font-extrabold leading-tight" aria-live="polite">
              {covered ? t('tonight.covered') : request ? t(`tonight.steps.${status === 'expired' || status === 'cancelled' ? 'posted' : status}`) : view.plan.tonight.message || t('tonight.askTitle')}
            </h2>
          </div>
          {!request && view.plan_source === 'ai' && <AiTag className="ml-auto" />}
          {covered && <Loopy mood="happy" size={52} className="ml-auto" />}
        </div>

        <div className="p-4">
          {!request && (
            <>
              <p className="text-sm text-muted-foreground">{t('tonight.askBody')}</p>
              <Button variant="accent" size="lg" className="mt-3 w-full" onClick={() => setSheet(true)}>
                <Utensils className="h-5 w-5" aria-hidden="true" /> {t('tonight.post')}
              </Button>
            </>
          )}

          {request && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{t('tonight.code')}</span>
                <span className="font-mono text-lg font-extrabold tracking-wider">{request.code}</span>
              </div>
              {!['expired', 'cancelled'].includes(status) && (
                <div className="mt-3">
                  <StatusTracker status={status} />
                </div>
              )}
              <p className="mt-3 text-[15px] font-medium" aria-live="polite">
                {covered && status === 'ready'
                  ? t('tonight.coveredBody', { code: request.code, hub: hubName, time: hhmmLabel(request.pickup_by, lang) })
                  : t(`tonight.statusText.${status}`, { hub: hubName })}
              </p>
              {status === 'posted' && <p className="mt-1 text-sm text-muted-foreground">{t('tonight.noMatchYet', { time: hhmmLabel(request.needed_by, lang) })}</p>}
              {(lang === 'es' ? request.bag_es : request.bag_en) && ['matched', 'on_the_way', 'ready'].includes(status) && (
                <p className="mt-2 rounded-xl bg-muted p-2.5 text-sm">{t('tonight.bagHas', { bag: lang === 'es' ? request.bag_es : request.bag_en })}</p>
              )}
              {status === 'ready' && (
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-3 w-full"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      onPlanChange(await act('confirmPickup', { token: view.token }));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('tonight.gotIt')}
                </Button>
              )}
              {status === 'picked_up' && !request.thank_you_sent && <ThankYou token={view.token} />}
              {status === 'picked_up' && request.thank_you_sent && <p className="mt-2 font-semibold text-success">{t('tonight.thanksSent')}</p>}
              {['posted', 'matched'].includes(status) && (
                <button
                  type="button"
                  className="mt-3 text-sm font-semibold text-muted-foreground underline underline-offset-2"
                  onClick={async () => {
                    try {
                      onPlanChange(await act('cancelRequest', { token: view.token }));
                    } catch {
                      /* toast shown */
                    }
                  }}
                >
                  {t('tonight.cancel')}
                </button>
              )}
            </>
          )}
        </div>
      </Card>
      <RequestSheet open={sheet} onClose={() => setSheet(false)} token={view.token} defaultSize={view.profile?.household_size} defaultPrefs={view.profile?.food_prefs} onPosted={onPlanChange} />
    </section>
  );
}
