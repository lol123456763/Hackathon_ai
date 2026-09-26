import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, TrendingUp, Megaphone } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { DEMO } from '@shared/constants.js';
import { centralParts } from '@shared/time.js';
import { AiTag } from '@/components/bits';
import { Button, Card, Input, Skeleton, Textarea } from '@/components/ui';

const PULSE_LABEL = { food: 'categories.food', utilities: 'chipCategories.utilities', school_supplies: 'tonight.types.school_supplies', housing: 'categories.housing', healthcare: 'categories.healthcare' };

export function usePulse() {
  const { act } = useApp();
  const [pulse, setPulse] = useState(null);
  useEffect(() => {
    let alive = true;
    act('pulse', { zip: DEMO.zip }, { silent: true })
      .then((p) => alive && setPulse(p))
      .catch(() => alive && setPulse({ error: true }));
    return () => {
      alive = false;
    };
  }, [act]);
  return pulse;
}

export function PulseCard({ pulse, compact, onStart }) {
  const { t, lang } = useI18n();
  if (!pulse) return <Skeleton className="h-40" />;
  if (pulse.error) return null;
  const b = pulse.brief;
  const rows = Object.entries(pulse.counts).sort((a, b2) => b2[1].this_week - a[1].this_week);
  const max = Math.max(...rows.map(([, v]) => v.this_week), 1);
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="font-extrabold">{t('hub.pulseTitle')}</h2>
        {pulse.source === 'ai' && <AiTag />}
      </div>
      <p className="mt-2 text-lg font-bold leading-snug">{lang === 'es' ? b.headline_es : b.headline_en}</p>
      {!compact && (
        <>
          <ul className="mt-3 space-y-2">
            {rows.map(([k, v]) => {
              const label = PULSE_LABEL[k] ? t(PULSE_LABEL[k]) : k;
              const up = v.this_week > v.last_week;
              return (
                <li key={k}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{label}</span>
                    <span className="tabular-nums">
                      {v.this_week} <span className="text-muted-foreground">({t('hub.lastWeek')} {v.last_week})</span> {up && <TrendingUp className="inline h-3.5 w-3.5 text-accent" aria-hidden="true" />}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(v.this_week / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {(lang === 'es' ? b.insights_es : b.insights_en).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t('hub.pulseHint', { zip: pulse.zip })}</p>
        </>
      )}
      {onStart && (
        <Button variant="accent" className="mt-3 w-full" onClick={onStart}>
          <Megaphone className="h-4 w-4" aria-hidden="true" /> {t('hub.startPopUp')}
        </Button>
      )}
    </Card>
  );
}

function nextDate(days) {
  const p = centralParts(Date.now() + days * 86400000);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export default function HubPulse() {
  const { t, lang } = useI18n();
  const { act, identity, toast } = useApp();
  const navigate = useNavigate();
  const pulse = usePulse();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  function start() {
    const s = pulse.brief.suggested_action;
    setDraft({ type: s.type, title_en: s.title_en, title_es: s.title_es, description_en: s.description_en, description_es: s.description_es, date: nextDate(2), start: '16:00', end: '18:00', min_age: 13, spots: 12 });
  }
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="space-y-4 pt-2">
      <PulseCard pulse={pulse} onStart={pulse && !pulse.error && !draft ? start : null} />
      {draft && (
        <Card className="space-y-3 p-4">
          <h2 className="font-extrabold">{t('hub.eventDraft')}</h2>
          <label className="block text-sm font-semibold">
            {t('hub.title')}
            <Input className="mt-1 min-h-[44px] font-normal" value={lang === 'es' ? draft.title_es : draft.title_en} onChange={set(lang === 'es' ? 'title_es' : 'title_en')} />
          </label>
          <label className="block text-sm font-semibold">
            {t('hub.description')}
            <Textarea rows={3} className="mt-1 font-normal" value={lang === 'es' ? draft.description_es : draft.description_en} onChange={set(lang === 'es' ? 'description_es' : 'description_en')} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-3 text-sm font-semibold sm:col-span-1">
              {t('hub.date')}
              <Input type="date" className="mt-1 min-h-[44px] font-normal" value={draft.date} onChange={set('date')} />
            </label>
            <label className="text-sm font-semibold">
              {t('hub.start')}
              <Input type="time" className="mt-1 min-h-[44px] font-normal" value={draft.start} onChange={set('start')} />
            </label>
            <label className="text-sm font-semibold">
              {t('hub.end')}
              <Input type="time" className="mt-1 min-h-[44px] font-normal" value={draft.end} onChange={set('end')} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-semibold">
              {t('hub.minAge')}
              <Input type="number" min={13} max={18} className="mt-1 min-h-[44px] font-normal" value={draft.min_age} onChange={set('min_age')} />
            </label>
            <label className="text-sm font-semibold">
              {t('hub.spots')}
              <Input type="number" min={1} max={200} className="mt-1 min-h-[44px] font-normal" value={draft.spots} onChange={set('spots')} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="accent"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await act('createEvent', { hub_key: identity, event: draft });
                  toast(t('hub.eventPosted', { code: r.checkin_code }), 'success');
                  navigate('/hub/events');
                } catch {
                  /* toast shown */
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('hub.postEvent')}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
