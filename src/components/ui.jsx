// Loop's UI primitives (see docs/DESIGN.md). Warm paper, soft mobile cards, and buttons that press down
// like physical keys. Different kinds of content get different paper objects (note, tag, ticket, receipt)
// so screens never repeat one shape.
import { forwardRef, useId } from 'react';
import { Icon } from './icons';

export function cn(...classes) {
  return classes.flat().filter(Boolean).join(' ');
}

const BUTTON_VARIANTS = {
  primary: 'press edge-primary bg-primary text-primary-foreground',
  accent: 'press edge-accent bg-accent text-accent-foreground',
  outline: 'press border-2 border-border bg-card text-foreground',
  soft: 'press bg-primary-soft text-primary-deep dark:text-foreground',
  danger: 'press edge-accent bg-danger text-danger-foreground',
  sun: 'press edge-sun bg-sun text-ink',
  ghost: 'text-foreground underline-offset-4 hover:underline decoration-2',
  link: 'text-primary underline underline-offset-4 decoration-2 px-0 min-h-0 h-auto',
};
const BUTTON_SIZES = {
  sm: 'min-h-[40px] px-4 text-sm gap-1.5',
  md: 'min-h-[48px] px-5 text-[15px] gap-2',
  lg: 'min-h-[56px] px-6 text-[17px] gap-2',
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
        'inline-flex select-none items-center justify-center rounded-full font-bold',
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

const TILTS = { 1: 'tilt-1', 2: 'tilt-2', 3: 'tilt-3' };
const FILLS = { teal: 'bg-primary-soft', tomato: 'bg-accent-soft', sun: 'bg-[#FFE7A8] dark:bg-sun/20', paper: 'bg-paper-2' };
const KINDS = {
  soft: 'rounded-[22px] border border-border shadow-soft',
  note: 'note',
  tag: 'tag-hole rounded-[6px_22px_22px_6px] border border-border shadow-soft pl-9',
  ticket: 'ticket rounded-[18px] shadow-soft',
  ink: 'rounded-[20px] border-2 border-ink shadow-ink',
  flat: 'rounded-[18px]',
};
/**
 * A piece of paper. `kind`: soft (default) | note (sticky note, for tips) | tag (surplus) | ticket (missions)
 * | ink (one hero card per screen) | flat. `tilt` 1|2|3 rotates it a touch; `lift` for tappable cards.
 */
export function Card({ className, as: Comp = 'div', kind = 'soft', tilt, lift = false, tone, ...props }) {
  const fill = FILLS[tone] || (kind === 'note' ? FILLS.sun : 'bg-card');
  return <Comp className={cn('relative text-card-foreground', KINDS[kind], fill, TILTS[tilt], lift && 'lift', className)} {...props} />;
}

const BADGE = {
  default: 'bg-paper-2 text-foreground',
  primary: 'bg-primary-soft text-primary-deep dark:text-foreground',
  accent: 'bg-accent-soft text-accent-deep',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-accent-deep',
  sun: 'bg-sun text-ink',
};
/** Small label. */
export function Badge({ variant = 'default', className, ...props }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', BADGE[variant], className)} {...props} />;
}

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-[48px] w-full rounded-[14px] border-2 border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground',
        'focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15',
        invalid && 'border-danger ring-2 ring-danger/40',
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
        'w-full resize-y rounded-[14px] border-2 border-input bg-card px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground',
        'focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15',
        className,
      )}
      {...props}
    />
  );
});

/** Large, tappable checkbox with a label. */
export function CheckItem({ checked, onChange, children, className, description, id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-[48px] cursor-pointer items-start gap-3 rounded-[16px] border border-border bg-card px-3 py-3 transition-colors hover:bg-paper-2/60',
        checked && 'bg-primary-soft',
        className,
      )}
    >
      <input id={id} type="checkbox" className="peer sr-only" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2 border-input bg-card transition-transform',
          'peer-focus-visible:ring-4 peer-focus-visible:ring-sun',
          checked && 'scale-110 border-primary bg-primary text-primary-foreground',
        )}
      >
        {checked && <Icon name="check" tone="none" className="h-5 w-5" strokeWidth={4} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-medium', checked && 'line-through decoration-2 opacity-70')}>{children}</span>
        {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-[16px] bg-paper-2', className)} aria-hidden="true" />;
}

const ALERT = {
  info: ['bg-primary-soft', 'info'],
  warning: ['bg-[#FFE7A8] dark:bg-sun/20', 'alert'],
  danger: ['bg-danger-soft', 'alert'],
  success: ['bg-success-soft', 'check'],
};
export function Alert({ variant = 'info', title, children, className, action, role }) {
  const [cls, icon] = ALERT[variant];
  return (
    <div role={role || (variant === 'danger' ? 'alert' : 'status')} className={cn('flex gap-3 rounded-[18px] p-4 text-[15px] text-ink dark:text-foreground', cls, className)}>
      <Icon name={icon} tone="none" className="mt-0.5 h-5 w-5 shrink-0" />
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

export function SectionTitle({ icon, title, hint, className, id }) {
  return (
    <div className={cn('mb-3', className)}>
      <h2 id={id} className="flex items-center gap-2 text-xl font-extrabold">
        {icon && <Icon name={icon} className="h-6 w-6" />}
        {title}
      </h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
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
        'press inline-flex min-h-[42px] items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-bold',
        selected ? 'edge-primary border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
