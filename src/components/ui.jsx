// Small, accessible UI primitives styled with the BenefitBridge design tokens.
import { forwardRef, useId } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export function cn(...classes) {
  return classes.flat().filter(Boolean).join(' ');
}

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[3px_4px_0_-1px_hsl(var(--primary)/0.35)]',
  accent: 'bg-accent text-accent-foreground hover:brightness-105 shadow-[3px_4px_0_-1px_hsl(var(--accent)/0.4)] font-bold',
  outline: 'border border-input bg-card text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  soft: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
  danger: 'bg-danger text-danger-foreground hover:bg-danger/90',
  link: 'text-primary underline-offset-4 hover:underline px-0 min-h-0 h-auto',
};
const BUTTON_SIZES = {
  sm: 'min-h-[40px] px-3 text-sm gap-1.5',
  md: 'min-h-[44px] px-4 text-[15px] gap-2',
  lg: 'min-h-[52px] px-6 text-base gap-2',
  icon: 'h-11 w-11',
};

// Spring-y press and hover for every button (framer-motion honors prefers-reduced-motion via MotionConfig).
const motionCache = new Map();
function motionOf(Comp) {
  if (typeof Comp === 'string') return motion[Comp] || motion.button;
  if (!motionCache.has(Comp)) motionCache.set(Comp, motion.create(Comp));
  return motionCache.get(Comp);
}

export const Button = forwardRef(function Button(
  { as: Comp = 'button', variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  const isButton = Comp === 'button';
  const M = motionOf(Comp);
  return (
    <M
      ref={ref}
      whileHover={disabled || loading ? undefined : { y: -2, rotate: -0.6 }}
      whileTap={disabled || loading ? undefined : { scale: 0.93, rotate: 0.8 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className={cn(
        'organic-btn inline-flex select-none items-center justify-center font-semibold transition-colors',
        'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...(isButton ? { type: props.type || 'button', disabled: disabled || loading } : {})}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </M>
  );
});

const ORGANIC = ['organic', 'organic-2', 'organic-3', 'organic-4'];
export function Card({ className, as: Comp = 'div', shape, lift = false, ...props }) {
  // Stable per-card shape (from React's id), so polling re-renders never make corners flicker.
  const id = useId();
  if (shape === undefined) shape = [...id].reduce((n, c) => n + c.charCodeAt(0), 0);
  // Organic corners cycle between four hand-made shapes so no two neighbouring cards look identical.
  return <Comp className={cn(ORGANIC[shape % 4], 'relative border border-foreground/10 bg-card text-card-foreground ink', lift && 'lift', className)} {...props} />;
}

const BADGE = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-foreground',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
};
export function Badge({ variant = 'default', className, ...props }) {
  return <span className={cn('sticker inline-flex -rotate-2 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', BADGE[variant], className)} {...props} />;
}

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'organic-btn min-h-[48px] w-full border-2 border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground',
        'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30',
        invalid && 'border-danger focus:border-danger focus:ring-danger/30',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'organic-3 w-full resize-y border-2 border-input bg-card px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground',
        'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30',
        className,
      )}
      {...props}
    />
  );
});

/** Large, tappable checkbox with a label; animates when checked. */
export function CheckItem({ checked, onChange, children, className, description, id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <label
      htmlFor={id}
      className={cn(
        'organic lift flex min-h-[48px] cursor-pointer items-start gap-3 border bg-card px-3 py-3 transition-colors hover:bg-muted/60',
        checked && 'border-primary/40 bg-primary-soft/60',
        className,
      )}
    >
      <input id={id} type="checkbox" className="peer sr-only" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-input bg-card transition',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
          checked && 'border-primary bg-primary text-primary-foreground',
        )}
      >
        {checked && <Check className="h-4 w-4 animate-pop" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block', checked && 'text-muted-foreground line-through decoration-2')}>{children}</span>
        {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

const ALERT = {
  info: ['bg-primary-soft text-foreground border-primary/20', Info],
  warning: ['bg-accent-soft text-foreground border-accent/40', AlertTriangle],
  danger: ['bg-danger-soft text-foreground border-danger/30', AlertTriangle],
  success: ['bg-success-soft text-foreground border-success/30', CheckCircle2],
};
export function Alert({ variant = 'info', title, children, className, action, role }) {
  const [cls, Icon] = ALERT[variant];
  return (
    <div role={role || (variant === 'danger' ? 'alert' : 'status')} className={cn('flex gap-3 rounded-xl border p-4 text-[15px]', cls, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className, label }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}

export function SectionTitle({ icon: Icon, title, hint, className, id }) {
  return (
    <div className={cn('mb-3', className)}>
      <h2 id={id} className="flex items-center gap-2 text-lg font-semibold">
        {Icon && <Icon className="h-5 w-5 text-primary" aria-hidden="true" />}
        {title}
      </h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Toggle chip (multi-select). */
export function Chip({ selected, onClick, children, className, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9, rotate: -3 }}
      animate={selected ? { scale: [1, 1.08, 1], rotate: [0, -2, 0] } : { scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      type="button"
      aria-pressed={!!selected}
      onClick={onClick}
      className={cn(
        'organic-btn inline-flex min-h-[40px] items-center gap-1.5 border-2 px-3.5 text-sm font-semibold transition-colors',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:bg-muted',
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
