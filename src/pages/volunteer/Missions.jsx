import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Footprints, Bike, Car, Bus, ChevronRight, CalendarDays, Users, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { hhmmLabel } from '@/lib/format';
import { CodeInput } from '@/components/bits';
import { Badge, Button, Card, Chip, cn } from '@/components/ui';
import VolunteerHeader from '@/components/VolunteerHeader';

const LiveMap = lazy(() => import('@/components/LiveMap'));
export const MODE_ICON = { walk: Footprints, bike: Bike, car: Car, transit: Bus };

export function MissionCard({ m }) {
  const { t, lang } = useI18n();
  const Icon = MODE_ICON[m.mode] || Footprints;
  const locked = !m.eligibility?.ok;
  const active = m.mine && ['claimed', 'picked_up'].includes(m.status);
  return (
    <Link
      to={`/missions/${m.key}`}
      className={cn('block rounded-2xl border bg-card p-4 shadow-soft transition hover:shadow-lift', active && 'border-2 border-accent', locked && 'opacity-70')}
      aria-label={`${lang === 'es' ? m.title_es : m.title_en}${locked ? ` — ${t('vol.locked')}` : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', locked ? 'bg-muted text-muted-foreground' : 'bg-accent-soft text-accent')}>
          {locked ? <Lock className="h-5 w-5" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">{lang === 'es' ? m.title_es : m.title_en}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {m.distance_mi} {t('common.mi')} {t(`vol.mode.${m.mode}`)} · {t('vol.about', { min: m.est_minutes })} · {hhmmLabel(m.window_start, lang)}–{hhmmLabel(m.window_end, lang)}
          </p>
          {(lang === 'es' ? m.impact_es : m.impact_en) && <p className="mt-1 text-sm font-semibold text-primary">{lang === 'es' ? m.impact_es : m.impact_en}</p>}
          {locked && m.eligibility.reasons.length > 0 && (
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              {m.eligibility.reasons.map((r) => t(`vol.reasons.${r}`)).join(' · ')}
            </p>
          )}
          {active && <Badge variant="accent" className="mt-1.5">{t('vol.claimed')}</Badge>}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </Link>
  );
}

export function EventsList() {
  const { t, lang } = useI18n();
  const { live, act, identity } = useApp();
  const [codes, setCodes] = useState({});
  const [errors, setErrors] = useState({});
  if (!live) return null;
  const events = [...live.events].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  return (
    <ul className="space-y-3">
      {events.map((e) => {
        const tooYoung = live.me && live.me.age < e.min_age;
        return (
          <li key={e.key}>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{lang === 'es' ? e.title_es : e.title_en}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(`${e.date}T12:00:00`).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {hhmmLabel(e.start, lang)}–{hhmmLabel(e.end, lang)} · {e.area_label}
                  </p>
                  <p className="mt-1 text-sm">{lang === 'es' ? e.description_es : e.description_en}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t('vol.spots', { count: e.rsvp_count, spots: e.spots })} · {t('vol.minAge', { age: e.min_age })} · +{e.hours_credit} h{e.sample && ` · ${t('demo.sample')}`}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                {e.checked_in ? (
                  <p className="flex items-center gap-1 font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('vol.checkedIn', { hours: e.hours_credit })}
                  </p>
                ) : tooYoung ? (
                  <p className="text-sm font-semibold text-muted-foreground">{t('vol.tooYoung', { age: e.min_age })}</p>
                ) : e.rsvped ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="success">{t('vol.rsvped')}</Badge>
                      <button type="button" className="text-sm underline" onClick={() => act('rsvpEvent', { event_key: e.key, volunteer_key: identity, going: false }).catch(() => {})}>
                        {t('vol.cancelRsvp')}
                      </button>
                    </div>
                    <CodeInput label={t('vol.checkinCode')} value={codes[e.key] || ''} onChange={(v) => setCodes((c) => ({ ...c, [e.key]: v }))} error={errors[e.key]} demoCode={e.demo_checkin} />
                    <Button
                      size="sm"
                      disabled={(codes[e.key] || '').length !== 4}
                      onClick={async () => {
                        try {
                          await act('eventCheckin', { event_key: e.key, volunteer_key: identity, code: codes[e.key] }, { silent: true });
                          setErrors((x) => ({ ...x, [e.key]: null }));
                        } catch (err) {
                          setErrors((x) => ({ ...x, [e.key]: err?.code === 'wrong_code' ? t('vol.wrongCode') : t('errors.generic') }));
                        }
                      }}
                    >
                      {t('vol.checkin')}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="soft" onClick={() => act('rsvpEvent', { event_key: e.key, volunteer_key: identity, going: true }).catch(() => {})}>
                    {t('vol.rsvp')}
                  </Button>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export default function Missions() {
  const { t } = useI18n();
  const { live } = useApp();
  const [tab, setTab] = useState('missions');
  const missions = (live?.missions || []).filter((m) => ['open', 'claimed', 'picked_up'].includes(m.status));
  const mine = missions.filter((m) => m.mine);
  const open = missions.filter((m) => !m.mine && m.status === 'open').sort((a, b) => Number(b.eligibility?.ok) - Number(a.eligibility?.ok) || String(b.created_at).localeCompare(String(a.created_at)));
  return (
    <div className="space-y-4 pt-2">
      <VolunteerHeader />
      <div className="flex gap-2" role="tablist">
        <Chip role="tab" aria-selected={tab === 'missions'} selected={tab === 'missions'} onClick={() => setTab('missions')}>
          {t('tabs.missions')}
        </Chip>
        <Chip role="tab" aria-selected={tab === 'events'} selected={tab === 'events'} onClick={() => setTab('events')}>
          {t('tabs.events')}
        </Chip>
      </div>
      {tab === 'missions' ? (
        <>
          <h1 className="text-lg font-extrabold">{t('vol.available')}</h1>
          <div className="space-y-3">
            {[...mine, ...open].map((m) => (
              <MissionCard key={m.key} m={m} />
            ))}
            {!mine.length && !open.length && <Card className="p-4 text-muted-foreground">{t('vol.none')}</Card>}
          </div>
          <Suspense fallback={<div className="skeleton h-52" />}>
            <LiveMap live={live} height={210} />
          </Suspense>
        </>
      ) : (
        <EventsList />
      )}
    </div>
  );
}
