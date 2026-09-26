// Loop's UI primitives, in BenefitBridge's visual language (see docs/DESIGN.md): hand-cut corners,
// pastel offset shadows, amber main actions, a serif for headlines.
import { forwardRef, useId } from 'react';
import { Check, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export function cn(...classes) {
  return classes.flat().filter(Boolean).join(' ');
}

const BUTTON_VARIANTS = {
  // amber = the one main action on a screen
  accent: 'wiggle-btn cut-btn bg-amber text-[#292b20] shadow-amber hover:brightness-105',
  primary: 'wiggle-btn cut-btn bg-primary text-primary-foreground shadow-mint hover:brightness-110',
  outline: 'wiggle-btn cut-btn border-2 border-border bg-card text-primary hover:bg-primary-soft',
  soft: 'wiggle-btn cut-btn bg-primary-soft text-primary hover:brightness-95',
  danger: 'wiggle-btn cut-btn bg-danger text-danger-foreground',
  sun: 'wiggle-btn cut-btn bg-amber text-[#292b20] shadow-amber',
  ghost: 'rounded-full text-primary hover:bg-primary-soft',
  link: 'text-primary underline decoration-amber-edge decoration-[3px] underline-offset-[5px] hover:decoration-primary px-0 min-h-0 h-auto',
};
const BUTTON_SIZES = {
  sm: 'min-h-[40px] px-4 text-sm gap-1.5',
  md: 'min-h-[48px] px-5 text-[15px] gap-2',
  lg: 'min-h-[54px] px-6 text-base gap-2',
  icon: 'h-11 w-11',
};

export const Button = forwardRef(function Button(
  { as: Comp = 'button', variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  const isButton = Comp === 'button';
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center font-extrabold',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...(isButton ? { type: props.type || 'button', disabled: disabled || loading } : {})}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-[3px] border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </Comp>
  );
});

const TONES = { 1: 'bg-tile-1', 2: 'bg-tile-2', 3: 'bg-tile-3', 4: 'bg-tile-4', 5: 'bg-tile-5', soft: 'bg-primary-soft', peach: 'bg-accent-soft' };
/**
 * A hand-cut card. `shape` 1–5 picks the corner cut (vary it between neighbours), `tone` a pastel fill,
 * `offset` adds BenefitBridge's flat pastel shadow, `lift` a hover lift for tappable cards.
 */
export function Card({ className, as: Comp = 'div', shape = 5, tone, offset = true, lift = false, ...props }) {
  return (
    <Comp
      className={cn('relative border-2 border-border text-card-foreground', `cut-${shape}`, TONES[tone] || 'bg-card', offset && 'shadow-offset', lift && 'tile-hover', className)}
      {...props}
    />
  );
}

const BADGE = {
  default: 'bg-muted text-foreground',
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  sun: 'bg-amber text-[#292b20]',
};
export function Badge({ variant = 'default', className, ...props }) {
  return <span className={cn('cut-chip inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold', BADGE[variant], className)} {...props} />;
}

const FIELD = 'cut-input w-full border-2 border-input bg-card text-base text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] focus:border-teal focus:outline-none focus:ring-4 focus:ring-[#9fd2ae]/30';

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(FIELD, 'min-h-[48px] px-4', invalid && 'border-danger', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(FIELD, 'resize-y bg-[#fffaf0] px-4 py-3 leading-relaxed dark:bg-card', className)} {...props} />;
});

/** Large, tappable checkbox with a label. */
export function CheckItem({ checked, onChange, children, className, description, id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <label
      htmlFor={id}
      className={cn(
        'cut-input flex min-h-[52px] cursor-pointer items-start gap-3 border-2 border-border bg-card px-3 py-3 transition-[transform,background-color] duration-200 hover:-translate-y-0.5',
        checked && 'bg-primary-soft shadow-amber',
        className,
      )}
    >
      <input id={id} type="checkbox" className="peer sr-only" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={cn(
          'cut-blob mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-input bg-card',
          'peer-focus-visible:ring-4 peer-focus-visible:ring-ring',
          checked && 'border-primary bg-primary text-primary-foreground',
        )}
      >
        {checked && <Check className="h-4 w-4" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-medium', checked && 'text-muted-foreground line-through')}>{children}</span>
        {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton cut-5', className)} aria-hidden="true" />;
}

const ALERT = {
  info: ['bg-primary-soft', Info],
  warning: ['bg-tile-4', AlertTriangle],
  danger: ['bg-danger-soft', AlertTriangle],
  success: ['bg-success-soft', CheckCircle2],
};
export function Alert({ variant = 'info', title, children, className, action, role }) {
  const [cls, Icon] = ALERT[variant];
  return (
    <div role={role || (variant === 'danger' ? 'alert' : 'status')} className={cn('cut-2 flex gap-3 border-2 border-border p-4 text-[15px]', cls, className)}>
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', variant === 'danger' ? 'text-danger' : 'text-primary')} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn(title && 'mt-1')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className, label }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}>
      <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}

/** Section heading: optional "02 /" tag, serif italic title. */
export function SectionTitle({ index, icon: Icon, title, hint, className, id }) {
  return (
    <div className={cn('mb-4', className)}>
      <div className="flex items-baseline gap-3">
        {index && <span className="section-index" aria-hidden="true">{index} /</span>}
        <h2 id={id} className="flex items-center gap-2 font-display text-2xl font-semibold italic tracking-tight">
          {Icon && <Icon className="h-5 w-5 not-italic text-teal" aria-hidden="true" />}
          {title}
        </h2>
      </div>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Serif page heading with an optional terracotta italic tail. */
export function PageTitle({ eyebrow, title, accent, sub, className, children }) {
  return (
    <header className={cn('mb-6', className)}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h1 className="font-display text-[2.1rem] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl">
        {title} {accent && <span className="italic-accent">{accent}</span>}
      </h1>
      {sub && <p className="mt-3 max-w-xl text-muted-foreground">{sub}</p>}
      {children}
      <div className="wavy-rule mt-5" aria-hidden="true" />
    </header>
  );
}

/** Toggle chip (multi-select). */
export function Chip({ selected, onClick, children, className, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      onClick={onClick}
      className={cn(
        'cut-chip inline-flex min-h-[42px] items-center gap-1.5 border-2 px-3.5 text-sm font-bold transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:-rotate-1',
        selected ? 'border-primary bg-primary text-primary-foreground shadow-amber' : 'border-border bg-card',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
