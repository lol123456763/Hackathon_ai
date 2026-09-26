import { Sun, FileCheck2, CalendarDays, LifeBuoy, Check, PartyPopper, Sparkles, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Badge, Card, CheckItem, SectionTitle, cn } from './ui';
import { telHref } from './ResourceCard';

function StepCard({ step, resource, doneKey, checklist, onCheck, index, t }) {
  const done = !!checklist[doneKey];
  const tel = telHref(resource?.phone);
  return (
    <li className="print-break-avoid relative pl-12">
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition',
          done ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/40 bg-card text-primary',
        )}
      >
        {done ? <Check className="h-5 w-5 animate-pop" strokeWidth={3} /> : index + 1}
      </span>
      <Card className={cn('p-4', done && 'bg-muted/40')}>
        <p className={cn('text-[17px] font-medium leading-snug', done && 'text-muted-foreground line-through decoration-2')}>{step.action}</p>
        {step.why && (
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold">{t('plan.why')}: </span>
            {step.why}
          </p>
        )}
        <div className="no-print mt-3 flex flex-wrap items-center gap-2">
          {tel && (
            <a href={tel} className="inline-flex min-h-[40px] items-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {t('resource.call')} {resource.phone}
            </a>
          )}
          {resource && (
            <a href={`#res-${resource.id}`} className="inline-flex min-h-[40px] items-center rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary-soft" onClick={(e) => {
              // The Plan page switches to the "All matches" tab and scrolls to this program.
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('bb:show-resource', { detail: resource.id }));
            }}>
              {t('plan.viewProgram')}
            </a>
          )}
          <label className="ml-auto inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-muted">
            <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={done} onChange={(e) => onCheck(doneKey, e.target.checked)} />
            {done ? t('plan.done') : t('plan.markDone')}
          </label>
        </div>
      </Card>
    </li>
  );
}

export default function ActionPlan({ plan, resources, checklist, onCheck, personalizing, aiFailed, onRetry, isLocal }) {
  const { t } = useI18n();
  if (!plan) return null;
  const stepKeys = [...plan.today.map((_, i) => `today.${i}`), ...plan.this_week.map((_, i) => `week.${i}`)];
  const doneCount = stepKeys.filter((k) => checklist[k]).length;
  const total = stepKeys.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="space-y-8" aria-busy={personalizing || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {plan.source === 'ai' ? (
            <Badge variant="accent">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t('plan.aiBadge')}
            </Badge>
          ) : (
            <Badge variant="primary">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" /> {t('plan.rulesBadge')}
            </Badge>
          )}
          {personalizing && (
            <span className="text-sm text-muted-foreground" role="status">
              {t('plan.personalizing')}
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="w-full sm:w-64">
            <p className="text-sm text-muted-foreground">{t('plan.progress', { done: doneCount, total })}</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {aiFailed && !isLocal && (
        <div className="no-print rounded-xl border border-accent/40 bg-accent-soft p-3 text-sm">
          {t('plan.personalizeFailed')}{' '}
          <button type="button" className="font-semibold underline" onClick={onRetry}>
            {t('plan.retry')}
          </button>
        </div>
      )}
      {isLocal && <p className="no-print rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t('plan.offlineNote')}</p>}

      {doneCount === total && total > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-success-soft p-4 font-semibold" role="status">
          <PartyPopper className="h-6 w-6 text-success" aria-hidden="true" /> {t('plan.allDone')}
        </div>
      )}

      <section aria-labelledby="plan-today" className={cn(personalizing && 'opacity-70 transition')}>
        <SectionTitle id="plan-today" icon={Sun} title={t('plan.today')} hint={t('plan.todayHint')} />
        <ol className="space-y-3">
          {plan.today.map((s, i) => (
            <StepCard key={`t${i}`} t={t} index={i} step={s} resource={resources[s.resource_id]} doneKey={`today.${i}`} checklist={checklist} onCheck={onCheck} />
          ))}
        </ol>
      </section>

      <section aria-labelledby="plan-bring">
        <SectionTitle id="plan-bring" icon={FileCheck2} title={t('plan.bring')} hint={t('plan.bringHint')} />
        <div className="grid gap-2 sm:grid-cols-2">
          {plan.bring.map((d, i) => (
            <CheckItem key={i} checked={!!checklist[`bring.${i}`]} onChange={(c) => onCheck(`bring.${i}`, c)}>
              {d}
            </CheckItem>
          ))}
        </div>
      </section>

      {plan.this_week.length > 0 && (
        <section aria-labelledby="plan-week" className={cn(personalizing && 'opacity-70 transition')}>
          <SectionTitle id="plan-week" icon={CalendarDays} title={t('plan.thisWeek')} hint={t('plan.thisWeekHint')} />
          <ol className="space-y-3">
            {plan.this_week.map((s, i) => (
              <StepCard key={`w${i}`} t={t} index={plan.today.length + i} step={s} resource={resources[s.resource_id]} doneKey={`week.${i}`} checklist={checklist} onCheck={onCheck} />
            ))}
          </ol>
        </section>
      )}

      {plan.fallbacks.length > 0 && (
        <section aria-labelledby="plan-fallbacks">
          <SectionTitle id="plan-fallbacks" icon={LifeBuoy} title={t('plan.fallbacks')} hint={t('plan.fallbacksHint')} />
          <ul className="space-y-2">
            {plan.fallbacks.map((f, i) => (
              <li key={i} className="print-break-avoid rounded-xl border bg-card p-4">
                <p className="font-semibold">{f.if}…</p>
                <p className="mt-1 text-muted-foreground">→ {f.then}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.encouragement && <p className="rounded-2xl bg-primary-soft p-5 text-center font-display text-lg font-semibold text-primary">{plan.encouragement}</p>}
    </div>
  );
}
