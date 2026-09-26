// "Live Loop" panel: 4 live counters, the neighborhood map, and the activity feed.
// Desktop: always visible to the right of the phone frame. Mobile: the Map tab.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
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
      {items.map(([k, v, dec], i) => (
        <Counter key={k} label={t(`impact.${k}`)} value={v} decimals={dec} i={i} />
      ))}
    </dl>
  );
}

/** A counter tile that does a happy jump (and shows +N) whenever its value goes up. */
function Counter({ label, value, decimals, i }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(null);
  const controls = useAnimationControls();
  useEffect(() => {
    if (prev.current != null && value != null && value > prev.current) {
      setBump({ id: Date.now(), delta: Math.round((value - prev.current) * 100) / 100 });
      controls.start({ scale: [1, 1.12, 0.96, 1], rotate: [0, -3, 2, 0], transition: { duration: 0.7 } });
    }
    prev.current = value;
  }, [value, controls]);
  return (
    <motion.div
      animate={controls}
      className={cn(['organic', 'organic-2', 'organic-3', 'organic-4'][i % 4], 'ink relative border border-foreground/10 bg-card p-3')}
    >
      {bump && (
        <motion.span key={bump.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -26 }} transition={{ duration: 1.6 }} className="hand absolute right-3 top-1 text-xl font-bold text-accent" aria-hidden="true">
          +{bump.delta}
        </motion.span>
      )}
      <dd className="font-display text-2xl font-extrabold text-primary">{value == null ? '—' : <RollingNumber value={value} decimals={decimals} />}</dd>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
    </motion.div>
  );
}

/** Scrolling news-ticker of the latest activity. */
export function Ticker({ items }) {
  const { lang } = useI18n();
  if (!items?.length) return null;
  const row = items.slice(0, 8).map((a) => (lang === 'es' ? a.message_es : a.message_en));
  return (
    <div className="organic-2 relative overflow-hidden border-2 border-dashed border-accent/40 bg-accent-soft/60 py-1.5" aria-hidden="true">
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap text-sm font-semibold text-foreground/80 motion-reduce:animate-none">
        {[...row, ...row].map((m, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-accent">✦</span> {m}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Feed({ items, max = 12, className }) {
  const { lang, t } = useI18n();
  if (!items) return null;
  return (
    <ol className={cn('space-y-1.5', className)} aria-live="polite" aria-label={t('map.feed')}>
      {items.slice(0, max).map((a) => (
        <motion.li layout initial={{ opacity: 0, x: 40, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} key={a.id} className="organic-btn flex gap-2 border border-foreground/5 bg-card px-3 py-2 text-sm ink">
          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.type === 'match' ? 'bg-accent' : a.type === 'covered' || a.type === 'delivered' ? 'bg-success' : a.type === 'unsafe' ? 'bg-danger' : 'bg-primary')} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {lang === 'es' ? a.message_es : a.message_en}
            {a.sample && <span className="ml-1 text-[10px] uppercase text-muted-foreground">· {t('demo.sample')}</span>}
          </span>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.at}>
            {relTime(a.at, lang)}
          </time>
        </motion.li>
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
      <Ticker items={live?.activity} />
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
