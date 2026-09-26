import { CalendarDays, Users, KeyRound } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { hhmmLabel } from '@/lib/format';
import { Card } from '@/components/ui';

export default function HubEvents() {
  const { t, lang } = useI18n();
  const { live, identity } = useApp();
  const events = (live?.events || []).filter((e) => e.hub_key === identity).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-extrabold">{t('hub.events')}</h1>
      {!events.length && <Card className="p-4 text-muted-foreground">{t('hub.noEvents')}</Card>}
      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.key}>
            <Card className="p-4">
              <p className="flex items-center gap-2 font-bold">
                <CalendarDays className="h-4 w-4 text-accent" aria-hidden="true" /> {lang === 'es' ? e.title_es : e.title_en}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(`${e.date}T12:00:00`).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {hhmmLabel(e.start, lang)}–{hhmmLabel(e.end, lang)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm">
                <Users className="h-4 w-4" aria-hidden="true" /> {t('vol.spots', { count: e.rsvp_count, spots: e.spots })}
              </p>
              {e.checkin_code && (
                <p className="mt-2 flex items-center gap-2 rounded-xl bg-primary-soft p-3 font-semibold text-primary">
                  <KeyRound className="h-5 w-5" aria-hidden="true" /> {t('hub.checkinCode', { code: '' })}
                  <span className="font-mono text-2xl font-extrabold tracking-widest">{e.checkin_code}</span>
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
