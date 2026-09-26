import { useState } from 'react';
import {
  Phone, Globe, MapPin, Clock, Sparkles, Plus, Check, FileText, ExternalLink, Flag, ChevronDown, Footprints, MonitorSmartphone, Languages,
} from 'lucide-react';
import { useI18n, formatDate, joinList } from '@/i18n';
import { api } from '@/api/backend';
import { CATEGORY_META } from '@/lib/categories';
import { Badge, Button, Card, cn } from './ui';

const LEVEL_STYLE = { very_likely: 'success', possibly: 'primary', worth_checking: 'default' };

export function telHref(phone) {
  if (!phone) return null;
  if (/^2-?1-?1$/.test(phone.trim())) return 'tel:211';
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 3) return null;
  return `tel:${digits.length === 10 ? `+1${digits}` : digits}`;
}

export function mapsHref(r) {
  if (!r.address) return null;
  const q = [r.address, r.city, 'TX', r.zip].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
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
    switch (reason.code) {
      case 'category':
        return t('resource.reasons.category', { categories: joinList((p.categories || []).map((c) => t(`categories.${c}`).toLowerCase()), lang) });
      case 'local':
        return p.county ? t('resource.reasons.local', { county: p.county }) : t('resource.reasons.localNoCounty');
      case 'statewide':
        return t('resource.reasons.statewide');
      case 'income_within':
        return t('resource.reasons.income_within', { pct: p.pct });
      case 'income_above':
        return t('resource.reasons.income_above', { pct: p.pct });
      case 'group':
        return (p.groups || []).map((g) => t(`resource.reasons.group.${g}`)).join(' ');
      default:
        return null;
    }
  };
}

export default function ResourceCard({ resource: r, match, planToken, saved, done, onToggleSaved, onToggleDone, headingLevel = 3, className }) {
  const { t, lang, field } = useI18n();
  const reasonText = useReasonText();
  const [explain, setExplain] = useState(null);
  const [explaining, setExplaining] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [reported, setReported] = useState(false);
  const [open, setOpen] = useState(false);
  const H = `h${headingLevel}`;

  const website = safeUrl(r.apply_url);
  const source = safeUrl(r.source_url);
  const tel = telHref(r.phone);
  const maps = mapsHref(r);
  const docs = r.documents_needed || [];
  const reasons = (match?.reasons || []).map(reasonText).filter(Boolean);

  async function doExplain() {
    if (explain?.lang === lang) {
      setShowExplain((s) => !s);
      return;
    }
    setExplaining(true);
    setShowExplain(true);
    try {
      const res = await api.explainResource(r.id || r.slug, lang);
      setExplain({ lang, bullets: res.bullets });
    } catch {
      setExplain({ lang, bullets: [field(r, 'description'), field(r, 'eligibility_summary'), field(r, 'how_to_apply')].filter(Boolean) });
    } finally {
      setExplaining(false);
    }
  }

  async function report() {
    setReported(true);
    try {
      await api.submitFeedback({ plan_token: planToken, resource_slug: r.id || r.slug, rating: 'wrong_info', language: lang });
    } catch {
      /* best effort */
    }
  }

  return (
    <Card as="article" className={cn('print-break-avoid overflow-hidden', done && 'opacity-80', className)} aria-labelledby={`res-${r.id}`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {match?.level && <Badge variant={LEVEL_STYLE[match.level]}>{t(`resource.match.${match.level}`)}</Badge>}
          {(match?.matched_categories?.length ? match.matched_categories : r.categories || []).slice(0, 3).map((c) => {
            const meta = CATEGORY_META[c];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <span key={c} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', meta.tint)}>
                <Icon className="h-3 w-3" aria-hidden="true" /> {t(`categories.${c}`)}
              </span>
            );
          })}
          {match?.distance != null && <span className="text-xs text-muted-foreground">{t('resource.distance', { miles: Math.max(1, Math.round(match.distance)) })}</span>}
          {['state', 'national'].includes(r.coverage_type) && <span className="text-xs text-muted-foreground">{t('resource.statewide')}</span>}
        </div>

        <H id={`res-${r.id}`} className={cn('mt-2 text-lg font-semibold leading-snug', done && 'line-through decoration-2')}>
          {r.name}
        </H>
        {r.organization && r.organization !== r.name && <p className="text-sm text-muted-foreground">{r.organization}</p>}

        <p className="mt-3">
          <span className="sr-only">{t('resource.whatItProvides')}: </span>
          {field(r, 'description')}
        </p>

        {reasons.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{t('resource.whyMatched')}: </span>
            {reasons.join(' ')}
          </p>
        )}

        <div className="no-print mt-4 flex flex-wrap gap-2">
          {tel && (
            <Button as="a" href={tel} size="sm">
              <Phone className="h-4 w-4" aria-hidden="true" /> {t('resource.call')} <span className="font-normal opacity-90">{r.phone}</span>
            </Button>
          )}
          {website && (
            <Button as="a" href={website} target="_blank" rel="noopener noreferrer" variant="outline" size="sm">
              <Globe className="h-4 w-4" aria-hidden="true" /> {t('resource.website')}
              <span className="sr-only"> (opens in a new tab)</span>
            </Button>
          )}
          {maps && (
            <Button as="a" href={maps} target="_blank" rel="noopener noreferrer" variant="outline" size="sm">
              <MapPin className="h-4 w-4" aria-hidden="true" /> {t('resource.directions')}
            </Button>
          )}
        </div>
        <p className="print-only mt-2 text-sm">
          {r.phone && <>☎ {r.phone} · </>}
          {website}
        </p>

        <button
          type="button"
          className="no-print mt-4 flex w-full items-center justify-between rounded-lg py-1 text-left text-sm font-semibold text-primary"
          aria-expanded={open}
          aria-controls={`res-details-${r.id}`}
          onClick={() => setOpen((o) => !o)}
        >
          {t('resource.howToApply')} · {t('resource.whatToBring')}
          <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} aria-hidden="true" />
        </button>

        <div id={`res-details-${r.id}`} className={cn('mt-2 space-y-3 text-[15px]', !open && 'hidden print:block')}>
          {field(r, 'eligibility_summary') && (
            <div>
              <h4 className="font-semibold">{t('resource.whoItsFor')}</h4>
              <p className="text-muted-foreground">{field(r, 'eligibility_summary')}</p>
            </div>
          )}
          {field(r, 'how_to_apply') && (
            <div>
              <h4 className="font-semibold">{t('resource.howToApply')}</h4>
              <p className="text-muted-foreground">{field(r, 'how_to_apply')}</p>
            </div>
          )}
          {docs.length > 0 && (
            <div>
              <h4 className="font-semibold">{t('resource.whatToBring')}</h4>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {docs.map((d) => (
                  <li key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {r.hours && (
              <div className="flex gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <dt className="font-semibold">{t('resource.hours')}</dt>
                  <dd className="text-muted-foreground">{r.hours}</dd>
                </div>
              </div>
            )}
            {r.address && (
              <div className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <dt className="sr-only">Address</dt>
                  <dd className="text-muted-foreground">{[r.address, r.city, r.zip].filter(Boolean).join(', ')}</dd>
                </div>
              </div>
            )}
            {(r.walk_in || r.apply_online) && (
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                {r.walk_in && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Footprints className="h-4 w-4 text-primary" aria-hidden="true" /> {t('resource.walkIn')}
                  </span>
                )}
                {r.apply_online && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MonitorSmartphone className="h-4 w-4 text-primary" aria-hidden="true" /> {t('resource.online')}
                  </span>
                )}
              </div>
            )}
            {r.languages?.length > 0 && (
              <div className="flex gap-2">
                <Languages className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <dt className="font-semibold">{t('resource.languages')}</dt>
                  <dd className="text-muted-foreground">{joinList(r.languages, lang)}</dd>
                </div>
              </div>
            )}
            {r.cost && (
              <div>
                <dt className="font-semibold">{t('resource.cost')}</dt>
                <dd className="text-muted-foreground">{r.cost}</dd>
              </div>
            )}
          </dl>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {r.verified_date && <span>{t('resource.lastVerified', { date: formatDate(r.verified_date, lang) })}</span>}
            {source && (
              <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                {t('resource.source')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
            <button type="button" onClick={report} disabled={reported} className="no-print inline-flex items-center gap-1 underline underline-offset-2 disabled:no-underline">
              <Flag className="h-3 w-3" aria-hidden="true" /> {reported ? t('resource.reported') : t('resource.reportWrong')}
            </button>
          </p>
        </div>

        {showExplain && (
          <div className="mt-4 rounded-xl bg-accent-soft p-4" aria-live="polite">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('resource.explainTitle')}
            </p>
            {explaining ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('resource.explaining')}</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {(explain?.bullets || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="no-print mt-4 flex flex-wrap gap-2 border-t pt-4">
          <Button variant="soft" size="sm" onClick={doExplain} aria-expanded={showExplain}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> {showExplain && explain?.lang === lang ? t('resource.hideExplain') : t('resource.explain')}
          </Button>
          {onToggleSaved && (
            <Button variant={saved ? 'primary' : 'outline'} size="sm" onClick={onToggleSaved} aria-pressed={!!saved}>
              {saved ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              {saved ? t('resource.added') : t('resource.addToPlan')}
            </Button>
          )}
          {onToggleDone && (
            <Button variant={done ? 'primary' : 'ghost'} size="sm" onClick={onToggleDone} aria-pressed={!!done}>
              <Check className="h-4 w-4" aria-hidden="true" /> {done ? t('resource.done') : t('resource.markDone')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
