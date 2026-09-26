// Loop-specific building blocks: AI tag, status tracker, code input with demo chip, rolling counters,
// sparkline, bottom sheet and toasts.
import { useEffect, useId, useRef, useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { TRACKER_STEPS } from '@shared/constants.js';
import { cn } from './ui';

export function AiTag({ className }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label={`${t('ai.tag')}: ${t('ai.tooltip')}`}
        title={t('ai.tooltip')}
      >
        <Sparkles className="h-3 w-3" aria-hidden="true" /> {t('ai.tag')}
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-7 z-30 w-56 rounded-lg bg-foreground p-2 text-xs font-medium text-background shadow-lift">
          {t('ai.tooltip')}
        </span>
      )}
    </span>
  );
}

export function StatusTracker({ status }) {
  const { t } = useI18n();
  const idx = TRACKER_STEPS.indexOf(status);
  return (
    <ol className="flex items-start justify-between gap-1" aria-label={t(`tonight.steps.${TRACKER_STEPS[Math.max(idx, 0)]}`)}>
      {TRACKER_STEPS.map((s, i) => {
        const done = idx >= i;
        const current = idx === i;
        return (
          <li key={s} className="flex flex-1 flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : done ? 'bg-primary' : 'bg-border')} />
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-500',
                  done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                  current && 'ring-4 ring-primary/20',
                )}
              >
                {done && <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className={cn('h-0.5 flex-1', i === TRACKER_STEPS.length - 1 ? 'opacity-0' : idx > i ? 'bg-primary' : 'bg-border')} />
            </div>
            <span className={cn('mt-1 text-[11px] font-semibold leading-tight', done ? 'text-foreground' : 'text-muted-foreground')}>{t(`tonight.steps.${s}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 4-digit code field with an optional tappable demo chip that fills in the right code. */
export function CodeInput({ label, value, onChange, demoCode, error, onEnter }) {
  const { t } = useI18n();
  const { hideHelpers } = useApp();
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {demoCode && !hideHelpers && (
          <button type="button" onClick={() => onChange(demoCode)} className="rounded-full border border-dashed border-accent px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent-soft">
            {t('demo.chip', { code: demoCode })}
          </button>
        )}
      </div>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(
          'mt-1 h-14 w-full rounded-xl border border-input bg-card text-center font-mono text-3xl font-bold tracking-[0.5em] focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30',
          error && 'border-danger',
        )}
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** A number that rolls up to its new value. */
export function RollingNumber({ value, decimals = 0, className }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 900);
      const eased = 1 - (1 - p) ** 3;
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const text = decimals ? Number(shown).toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : Math.round(shown).toLocaleString();
  return (
    <span className={cn('tabular-nums', className)} aria-live="polite">
      {text}
    </span>
  );
}

export function Sparkline({ data, className }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - (v / max) * 26}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn('h-6 w-full', className)} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Bottom sheet (mobile) / centered dialog (desktop frame) with focus handling. */
export function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end lg:absolute justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92%] w-full max-w-md animate-fade-up overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lift focus:outline-none sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div
          key={x.id}
          className={cn(
            'pointer-events-auto animate-fade-up rounded-full px-4 py-2 text-sm font-semibold shadow-lift',
            x.variant === 'danger' ? 'bg-danger text-danger-foreground' : x.variant === 'success' ? 'bg-success text-white' : 'bg-foreground text-background',
          )}
        >
          {x.message}
        </div>
      ))}
    </div>
  );
}

/** Gentle teal + coral confetti (skipped under reduced motion). */
export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 9) * 0.08, color: i % 2 ? '#0F766E' : '#C2410C', rot: (i * 47) % 360, size: 6 + (i % 4) * 2 })),
  );
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block rounded-sm"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color, transform: `rotate(${p.rot}deg)`, animation: `confetti 1.8s ease-in ${p.delay}s forwards` }}
        />
      ))}
      <style>{'@keyframes confetti{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(520px) rotate(540deg);opacity:0}}'}</style>
    </div>
  );
}
