// Small, accessible UI primitives styled with the BenefitBridge design tokens.
import { forwardRef, useId } from 'react';
import { Check, Loader2, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export function cn(...classes) {
  return classes.flat().filter(Boolean).join(' ');
}

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft',
  accent: 'bg-accent text-accent-foreground hover:brightness-95 shadow-soft font-semibold',
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

export const Button = forwardRef(function Button(
  { as: Comp = 'button', variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  const isButton = Comp === 'button';
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-xl font-medium transition',
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
    </Comp>
  );
});

export function Card({ className, as: Comp = 'div', ...props }) {
  return <Comp className={cn('rounded-2xl border bg-card text-card-foreground shadow-soft', className)} {...props} />;
}

const BADGE = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-foreground',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
};
export function Badge({ variant = 'default', className, ...props }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', BADGE[variant], className)} {...props} />;
}

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-[48px] w-full rounded-xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground',
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
        'w-full resize-y rounded-2xl border border-input bg-card px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground',
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
        'flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border bg-card px-3 py-3 transition hover:bg-muted/60',
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
    <button
      type="button"
      aria-pressed={!!selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:bg-muted',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
