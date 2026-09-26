import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Globe2, Users2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { fmtHours } from '@/lib/format';
import LivePanel, { Counters, Feed } from '@/components/LivePanel';
import { RollingNumber, Sparkline } from '@/components/bits';
import LoopRing from '@/components/LoopRing';
import { Button, Card } from '@/components/ui';
import { PulseCard, usePulse } from '@/pages/hub/HubPulse';

export function MapPage() {
  return (
    <div className="pt-2">
      <LivePanel mobile />
    </div>
  );
}

export function ImpactPage() {
  const { t } = useI18n();
  const { live, role } = useApp();
  const pulse = usePulse();
  const imp = live?.impact;
  return (
    <div className="space-y-5 pt-2">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <LoopRing size={32} /> {t('impact.title')}
      </h1>
      <Counters impact={imp} compact />
      <dl className="grid grid-cols-3 gap-2">
        {[
          ['projects', imp?.projects],
          ['plans', imp?.plans],
          ['volunteers', imp?.volunteers],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-3">
            <dd className="text-xl font-extrabold text-primary">{v == null ? '—' : <RollingNumber value={v} />}</dd>
            <dt className="text-xs text-muted-foreground">{t(`impact.${k}`)}</dt>
          </div>
        ))}
      </dl>
      {live?.spark && (
        <Card className="p-4">
          <h2 className="font-extrabold">{t('impact.thisWeek')}</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {['lbs', 'meals', 'families', 'hours'].map((k) => (
              <div key={k} className="text-primary">
                <p className="text-xs font-semibold text-muted-foreground">{t(`impact.${k}`)}</p>
                <Sparkline data={live.spark[k]} />
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Users2 className="h-5 w-5 text-primary" aria-hidden="true" /> {t('impact.teams')}
        </h2>
        <ol className="mt-2 space-y-1">
          {(live?.teams || []).map((tm, i) => (
            <li key={tm.key} className="flex justify-between text-sm">
              <span>
                {i + 1}. {tm.name}
              </span>
              <span className="font-bold tabular-nums">{fmtHours(tm.total_hours)} h</span>
            </li>
          ))}
        </ol>
      </Card>
      <section>
        <h2 className="mb-2 font-extrabold">{t('impact.recent')}</h2>
        <Feed items={live?.activity} max={10} />
      </section>
      <PulseCard pulse={pulse} compact onStart={null} />
      {role === 'hub' && (
        <Button as={Link} to="/hub/pulse" variant="accent" className="w-full">
          {t('hub.startPopUp')}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {t('impact.sampleNote')} {t('impact.mealsNote')}
      </p>
    </div>
  );
}

export function AboutPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-5 pt-2">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <LoopRing size={32} closed /> {t('about.title')}
      </h1>
      <p className="text-lg font-semibold">{t('app.tagline')}</p>
      <Card className="p-4">
        <h2 className="font-extrabold">{t('about.worldsTitle')}</h2>
        <p className="mt-2 text-sm">{t('about.formal')}</p>
        <p className="mt-2 text-sm">{t('about.community')}</p>
      </Card>
      <section>
        <h2 className="mb-2 font-extrabold">{t('about.loopTitle')}</h2>
        <ol className="relative space-y-2">
          {t('about.steps').map((s, i) => (
            <li key={i} className="flex gap-3 rounded-xl border bg-card p-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-extrabold text-white ${i % 2 ? 'bg-accent' : 'bg-primary'}`}>{i + 1}</span>
              <p className="text-sm">{s}</p>
            </li>
          ))}
        </ol>
      </section>
      <Card className="p-4">
        <h2 className="font-extrabold">{t('about.coordTitle')}</h2>
        <p className="mt-2 text-sm">{t('about.coordBody')}</p>
      </Card>
      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Globe2 className="h-5 w-5 text-primary" aria-hidden="true" /> {t('about.dataTitle')}
        </h2>
        <p className="mt-2 text-sm">{t('about.data')}</p>
      </Card>
      <p className="text-sm text-muted-foreground">{t('about.team')}</p>
      <Button as={Link} to="/help" variant="accent" className="w-full">
        {t('about.cta')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function TrustPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4 pt-2">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" /> {t('trust.title')}
      </h1>
      <p className="text-muted-foreground">{t('trust.lead')}</p>
      {t('trust.sections').map(([title, items]) => (
        <Card key={title} className="p-4">
          <h2 className="font-extrabold">{title}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-extrabold">{t('common.notFoundTitle')}</h1>
      <Button as={Link} to="/" className="mt-4">
        {t('common.goHome')}
      </Button>
    </div>
  );
}
