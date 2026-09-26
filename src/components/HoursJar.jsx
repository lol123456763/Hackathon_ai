// The hours jar: one sun-yellow marble per verified hour, dropping in as hours are earned.
import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/i18n';
import { fmtHours } from '@/lib/format';

const MILESTONES = [10, 25, 50, 100];
const PER_ROW = 6;
const R = 7;

export default function HoursJar({ hours = 0 }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const whole = Math.min(Math.floor(hours), 48);
  const partial = hours % 1 > 0.05 && whole < 48;
  const count = whole + (partial ? 1 : 0);
  const goal = MILESTONES.find((m) => m > hours) || MILESTONES.at(-1);
  const marbles = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / PER_ROW);
    const col = i % PER_ROW;
    const shift = row % 2 ? R : 0;
    return { x: 30 + col * (R * 2 + 1) + shift - (row % 2 && col === PER_ROW - 1 ? R * 2 : 0), y: 150 - R - row * (R * 1.75), half: partial && i === count - 1 };
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 170" className="h-40 w-32 shrink-0" role="img" aria-label={t('vol.jar.label', { hours: fmtHours(hours) })}>
        {/* lid */}
        <rect x="30" y="10" width="80" height="16" rx="4" fill="#f4ad8d" stroke="hsl(var(--ink))" strokeWidth="3" />
        {/* glass */}
        <path d="M34 28 C 20 40, 18 52, 18 70 L 18 146 C 18 156, 26 162, 36 162 L 104 162 C 114 162, 122 156, 122 146 L 122 70 C 122 52, 120 40, 106 28 Z" fill="hsl(var(--card))" stroke="hsl(var(--ink))" strokeWidth="3" />
        {marbles.map((m, i) => (
          <motion.circle
            key={i}
            cx={m.x}
            r={R}
            fill="hsl(var(--amber))"
            stroke="hsl(var(--ink))"
            strokeWidth="2"
            opacity={m.half ? 0.45 : 1}
            initial={reduce ? false : { cy: 20 }}
            animate={{ cy: m.y }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: reduce ? 0 : 0.05 * i }}
          />
        ))}
        {/* glint */}
        <path d="M30 60 C 28 72, 28 96, 30 110" fill="none" stroke="hsl(var(--ink) / 0.15)" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div>
        <p className="font-display text-4xl font-semibold leading-none tracking-tight">{fmtHours(hours)} h</p>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{t('vol.jar.verified')}</p>
        <p className="mt-2 font-display text-lg italic leading-tight text-accent">
          {hours >= MILESTONES.at(-1) ? t('vol.jar.full') : t('vol.jar.next', { left: fmtHours(goal - hours), goal })}
        </p>
      </div>
    </div>
  );
}
