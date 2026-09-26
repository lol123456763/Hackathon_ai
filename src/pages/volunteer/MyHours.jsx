import { useState } from 'react';
import { Printer, Share2, CheckCircle2 } from 'lucide-react';
import { useI18n, formatDate } from '@/i18n';
import { useApp } from '@/state/app';
import { formatTime } from '@shared/time.js';
import { fmtHours } from '@/lib/format';
import { Button, Card } from '@/components/ui';
import VolunteerHeader from '@/components/VolunteerHeader';
import ImpactCard from '@/components/ImpactCard';

export default function MyHours() {
  const { t, lang } = useI18n();
  const { live } = useApp();
  const [share, setShare] = useState(false);
  const me = live?.me;
  const team = me && live.teams.find((x) => x.key === me.team_key);
  const log = [...(me?.hours_log || [])].reverse();
  return (
    <div className="space-y-4 pt-2">
      <VolunteerHeader />
      <div className="no-print flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" /> {t('vol.printLog')}
        </Button>
        <Button variant="soft" size="sm" onClick={() => setShare((s) => !s)} aria-expanded={share}>
          <Share2 className="h-4 w-4" aria-hidden="true" /> {t('vol.shareImpact')}
        </Button>
      </div>
      {share && me && <ImpactCard me={me} team={team?.name} />}
      <section aria-labelledby="log-title">
        <h1 id="log-title" className="text-lg font-extrabold">
          {t('vol.log')}
        </h1>
        <div className="print-only mb-2 text-sm">
          {me?.display_name} · {team?.name} · {t('vol.total')}: {fmtHours(me?.total_hours)} h
        </div>
        {!log.length ? (
          <Card className="mt-2 p-4 text-muted-foreground">{t('vol.logEmpty')}</Card>
        ) : (
          <ul className="mt-2 space-y-2">
            {log.map((e, i) => (
              <li key={`${e.key}-${i}`}>
                <Card className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{lang === 'es' ? e.title_es : e.title_en}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(new Date(e.at).toISOString(), lang)} · {formatTime(e.at, lang)} · {e.hub}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {e.kind === 'event' ? t('vol.verifiedByEvent') : t('vol.verifiedBy')}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-extrabold text-primary">+{fmtHours(e.hours)} h</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      {me && (
        <p className="text-sm text-muted-foreground">
          {t('vol.total')}: <span className="font-bold text-foreground">{fmtHours(me.total_hours)} h</span> · {t('vol.team')}: {team?.name} ({fmtHours(team?.total_hours)} h)
        </p>
      )}
    </div>
  );
}
