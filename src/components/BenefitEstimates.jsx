import { PiggyBank } from 'lucide-react';
import { useI18n, formatMoney } from '@/i18n';
import { BENEFIT_RULES } from '@shared/benefits.js';
import { Badge, Card, SectionTitle } from './ui';

const STATUS_VARIANT = { likely: 'success', maybe: 'accent', unlikely: 'default' };

export default function BenefitEstimates({ estimates }) {
  const { t, lang } = useI18n();
  const shown = (estimates || []).filter((e) => e.status !== 'unlikely' || e.id === 'snap');
  if (!shown.length) return null;

  function amount(e) {
    if (e.id === 'school_meals') return e.detail === 'free' ? t('plan.schoolFree') : e.detail ? t('plan.schoolFreeOrReduced') : null;
    if (e.id === 'ceap' && e.detail?.startsWith('up_to:')) return t('plan.upTo', { amount: formatMoney(Number(e.detail.slice(6)), lang) });
    if (!e.monthly || e.status === 'unlikely') return null;
    if (e.monthly.low === e.monthly.high) return t('plan.perMonth', { amount: formatMoney(e.monthly.low, lang) });
    return t('plan.between', { low: formatMoney(e.monthly.low, lang), high: formatMoney(e.monthly.high, lang) });
  }

  return (
    <section aria-labelledby="estimates-title">
      <SectionTitle id="estimates-title" icon={PiggyBank} title={t('plan.estimatesTitle')} hint={t('plan.estimatesHint', { year: BENEFIT_RULES.year })} />
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((e) => {
          const a = amount(e);
          return (
            <Card key={e.id} className="print-break-avoid p-4">
              <p className="font-semibold">{t(`plan.estimateNames.${e.id}`)}</p>
              {a && <p className="mt-1 font-display text-xl font-bold text-primary">{a}</p>}
              <Badge className="mt-2" variant={STATUS_VARIANT[e.status]}>
                {t(`plan.estimateStatus.${e.status}`)}
              </Badge>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
