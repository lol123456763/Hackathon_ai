import { useState } from 'react';
import { Phone, Globe, Clock, Check, FileText, ExternalLink, ChevronDown } from 'lucide-react';
import { useI18n, formatDate, joinList } from '@/i18n';
import { api } from '@/api/backend';
import { AiTag } from './bits';
import { Badge, Button, Card, cn } from './ui';

const LEVEL_STYLE = { very_likely: 'success', possibly: 'primary', worth_checking: 'default' };

export function telHref(phone) {
  if (!phone) return null;
  if (/^2-?1-?1$/.test(phone.trim())) return 'tel:211';
  if (/^9-?8-?8$/.test(phone.trim())) return 'tel:988';
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 3) return null;
  return `tel:${digits.length === 10 ? `+1${digits}` : digits.length === 11 ? `+${digits}` : digits}`;
}

export function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function useReasonText() {
  const { t, lang } = useI18n();
  return (reason) => {
    const p = reason.params || {};
    if (reason.code === 'category') return t('resource.reasons.category', { categories: joinList((p.categories || []).map((c) => t(`chipCategories.${c}`)), lang) });
    if (reason.code === 'local') return t('resource.reasons.local');
    if (reason.code === 'statewide') return t('resource.reasons.statewide');
    if (reason.code === 'signals') return (p.signals || []).map((s) => t(`resource.reasons.signals.${s}`)).join(' ');
    return null;
  };
}

export default function ResourceCard({ resource: r, match, done, onToggleDone, id }) {
  const { t, lang, field } = useI18n();
  const reasonText = useReasonText();
  const [open, setOpen] = useState(false);
  const [explain, setExplain] = useState(null);
  const [explaining, setExplaining] = useState(false);

  const website = safeUrl(r.apply_url);
  const source = safeUrl(r.source_url);
  const tel = telHref(r.phone);
  const docs = lang === 'es' && r.documents_es?.length ? r.documents_es : r.documents || [];
  const reasons = (match?.reasons || []).map(reasonText).filter(Boolean);

  async function doExplain() {
    if (explain?.lang === lang) {
      setExplain(null);
      return;
    }
    setExplaining(true);
    try {
      const res = await api.call('explainResource', { slug: r.id || r.slug, language: lang });
      setExplain({ lang, bullets: res.bullets, ai: res.source === 'ai' });
    } catch {
      setExplain({ lang, bullets: [field(r, 'what_it_gives'), field(r, 'who_its_for'), field(r, 'how_to_apply')].filter(Boolean), ai: false });
    } finally {
      setExplaining(false);
    }
  }

  return (
    <Card as="article" id={id} className={cn('scroll-mt-20 p-4 transition', done && 'opacity-75')} aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {match?.level && <Badge variant={LEVEL_STYLE[match.level]}>{t(`resource.match.${match.level}`)}</Badge>}
        {['city', 'county', 'region'].includes(r.coverage_type) && <Badge variant="primary">{t('resource.local')}</Badge>}
      </div>
      <h3 id={`${id}-title`} className={cn('mt-2 text-base font-bold leading-snug', done && 'line-through decoration-2')}>
        {field(r, 'name')}
      </h3>
      {r.organization && r.organization !== r.name && <p className="text-sm text-muted-foreground">{r.organization}</p>}
      <p className="mt-2 text-[15px]">
        <span className="font-semibold">{t('resource.whatItGives')}: </span>
        {field(r, 'what_it_gives')}
      </p>
      {reasons.length > 0 && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{t('resource.whyMatched')}: </span>
          {reasons.join(' ')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {tel && (
          <Button as="a" href={tel} size="sm">
            <Phone className="h-4 w-4" aria-hidden="true" /> {r.phone}
          </Button>
        )}
        {website && (
          <Button as="a" href={website} target="_blank" rel="noopener noreferrer" variant="outline" size="sm">
            <Globe className="h-4 w-4" aria-hidden="true" /> {t('resource.website')}
          </Button>
        )}
      </div>

      <button type="button" className="mt-3 flex w-full items-center justify-between py-1 text-left text-sm font-semibold text-primary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t('resource.whoItsFor')} · {t('resource.howToApply')}
        <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-1 space-y-2 text-sm">
          {field(r, 'who_its_for') && (
            <p>
              <span className="font-semibold">{t('resource.whoItsFor')}: </span>
              {field(r, 'who_its_for')}
            </p>
          )}
          {field(r, 'how_to_apply') && (
            <p>
              <span className="font-semibold">{t('resource.howToApply')}: </span>
              {field(r, 'how_to_apply')}
            </p>
          )}
          {docs.length > 0 && (
            <div>
              <p className="font-semibold">{t('resource.whatToBring')}</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {docs.map((d) => (
                  <li key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                    <FileText className="h-3 w-3" aria-hidden="true" /> {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.hours && (
            <p className="flex items-start gap-1.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {r.hours}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {r.last_checked_date && <span>{t('resource.lastChecked', { date: formatDate(r.last_checked_date, lang) })}</span>}
            {source && (
              <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                {t('resource.source')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </p>
        </div>
      )}

      {explain && explain.lang === lang && (
        <div className="mt-3 rounded-xl bg-accent-soft/70 p-3" aria-live="polite">
          {explain.ai && <AiTag className="mb-1" />}
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {explain.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        <Button variant="soft" size="sm" onClick={doExplain} loading={explaining} aria-expanded={!!explain}>
          {explaining ? t('resource.explaining') : explain?.lang === lang ? t('resource.hide') : t('resource.explain')}
        </Button>
        {onToggleDone && (
          <Button variant={done ? 'primary' : 'ghost'} size="sm" onClick={onToggleDone} aria-pressed={!!done}>
            <Check className="h-4 w-4" aria-hidden="true" /> {done ? t('resource.done') : t('resource.markDone')}
          </Button>
        )}
      </div>
    </Card>
  );
}
