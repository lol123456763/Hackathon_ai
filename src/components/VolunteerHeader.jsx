import { ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { fmtHours } from '@/lib/format';
import { Card } from './ui';

export default function VolunteerHeader() {
  const { t } = useI18n();
  const { live } = useApp();
  const me = live?.me;
  if (!me) return <div className="skeleton h-24" />;
  const team = live.teams.find((x) => x.key === me.team_key);
  const initials = me.display_name.split(' ').map((p) => p[0]).join('').slice(0, 2);
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground" aria-hidden="true">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="font-extrabold">
            {me.display_name} · {me.age} · {team?.name}
          </p>
          {me.age < 18 && me.guardian_consent && (
            <p className="flex items-center gap-1 text-xs font-semibold text-success">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t('vol.guardian')}
            </p>
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          [fmtHours(me.total_hours), t('vol.hours')],
          [Math.round(me.total_lbs), t('vol.lbs')],
          [me.missions_done, t('vol.missions')],
        ].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-muted p-2">
            <dd className="text-xl font-extrabold text-primary">{v}</dd>
            <dt className="text-[11px] text-muted-foreground">{l}</dt>
          </div>
        ))}
      </dl>
    </Card>
  );
}
