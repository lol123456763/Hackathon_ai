// "Live Loop" panel: 4 live counters, the neighborhood map, and the activity feed.
// Desktop: always visible to the right of the phone frame. Mobile: the Map tab.
import { lazy, Suspense } from 'react';
import { Radio } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { formatTime } from '@shared/time.js';
import { RollingNumber } from './bits';
import LoopRing from './LoopRing';
import { cn } from './ui';

const LiveMap = lazy(() => import('./LiveMap'));

export function Counters({ impact, compact }) {
  const { t } = useI18n();
  const items = [
    ['lbs', impact?.lbs, 0],
    ['meals', impact?.meals, 0],
    ['families', impact?.families, 0],
    ['hours', impact?.hours, 2],
  ];
  return (
    <dl className={cn('grid grid-cols-2 gap-2', !compact && 'xl:grid-cols-4')}>
      {items.map(([k, v, dec]) => (
        <div key={k} className="rounded-2xl border bg-card p-3 shadow-soft">
          <dd className="font-display text-2xl font-extrabold text-primary">{v == null ? '—' : <RollingNumber value={v} decimals={dec} />}</dd>
          <dt className="text-xs font-medium text-muted-foreground">{t(`impact.${k}`)}</dt>
        </div>
      ))}
    </dl>
  );
}

export function Feed({ items, max = 12, className }) {
  const { lang, t } = useI18n();
  if (!items) return null;
  return (
    <ol className={cn('space-y-1.5', className)} aria-live="polite" aria-label={t('map.feed')}>
      {items.slice(0, max).map((a) => (
        <li key={a.id} className="flex animate-fade-up gap-2 rounded-xl bg-card px-3 py-2 text-sm shadow-soft">
          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.type === 'match' ? 'bg-accent' : a.type === 'covered' || a.type === 'delivered' ? 'bg-success' : a.type === 'unsafe' ? 'bg-danger' : 'bg-primary')} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {lang === 'es' ? a.message_es : a.message_en}
            {a.sample && <span className="ml-1 text-[10px] uppercase text-muted-foreground">· {t('demo.sample')}</span>}
          </span>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.at}>
            {relTime(a.at, lang)}
          </time>
        </li>
      ))}
    </ol>
  );
}

export function relTime(iso, lang) {
  const diff = (Date.now() - Date.parse(iso)) / 60000;
  const rtf = new Intl.RelativeTimeFormat(lang === 'es' ? 'es' : 'en', { numeric: 'auto', style: 'narrow' });
  if (diff < 1) return rtf.format(0, 'minute');
  if (diff < 60) return rtf.format(-Math.round(diff), 'minute');
  if (diff < 1440) return rtf.format(-Math.round(diff / 60), 'hour');
  return rtf.format(-Math.round(diff / 1440), 'day');
}

export default function LivePanel({ mobile = false }) {
  const { t, lang } = useI18n();
  const { live } = useApp();
  return (
    <section className={cn('flex w-full min-w-0 flex-col gap-3', !mobile && 'h-full')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
          <LoopRing size={28} /> {t('map.title')}
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">
            <Radio className="h-3 w-3 animate-pulse" aria-hidden="true" /> LIVE
          </span>
        </h2>
        {live && <span className="text-sm font-medium text-muted-foreground">{t('demo.clock', { time: formatTime(live.clock.now, lang) })}</span>}
      </div>
      <Counters impact={live?.impact} compact={mobile} />
      <div className={cn(mobile ? 'h-[340px]' : 'min-h-[220px] flex-1')}>
        <Suspense fallback={<div className="skeleton h-full w-full" />}>
          <LiveMap live={live} height="100%" className="h-full" />
        </Suspense>
      </div>
      <p className="text-xs text-muted-foreground">{t('map.privacy')}</p>
      <div className={cn('min-h-0', mobile ? '' : 'h-[184px] overflow-y-auto scroll-thin')}>
        <Feed items={live?.activity} max={mobile ? 10 : 20} />
      </div>
    </section>
  );
}
