import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api } from '@/api/backend';
import { lookupZip, distanceMiles, resourceLocation } from '@shared/zip.js';
import { coversLocation } from '@shared/matching.js';
import { CATEGORIES } from '@/lib/categories';
import { Alert, Button, Card, Chip, Input, Skeleton } from '@/components/ui';
import ResourceCard from '@/components/ResourceCard';

const PAGE = 30;
const LOCAL_RANK = { city: 0, county: 0, region: 1, state: 2, national: 3 };

export default function Browse() {
  const { t, field } = useI18n();
  const [all, setAll] = useState(null);
  const [error, setError] = useState(false);
  const [zip, setZip] = useState('');
  const [cats, setCats] = useState([]);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    api
      .listResources()
      .then(setAll)
      .catch(() => setError(true));
  }, []);

  const place = lookupZip(zip);
  const results = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    let list = all.filter((r) => {
      if (place.valid && !coversLocation(r, place)) return false;
      if (cats.length && !cats.some((c) => (r.categories || []).includes(c))) return false;
      if (q && !`${r.name} ${r.organization || ''} ${field(r, 'description')} ${r.city || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list = list.map((r) => {
      const loc = resourceLocation(r);
      return { r, d: place.valid && loc ? distanceMiles(place, loc) : null };
    });
    list.sort((a, b) => (LOCAL_RANK[a.r.coverage_type] ?? 4) - (LOCAL_RANK[b.r.coverage_type] ?? 4) || (a.d ?? 9999) - (b.d ?? 9999) || a.r.name.localeCompare(b.r.name));
    return list;
  }, [all, place.valid, place.zip, cats, query, field]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setLimit(PAGE), [zip, cats, query]);

  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('browse.title')}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{t('browse.subtitle')}</p>

      <Card className="mt-6 space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div>
            <label htmlFor="browse-zip" className="text-sm font-semibold">
              {t('browse.zipLabel')}
            </label>
            <Input id="browse-zip" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} className="mt-1" aria-describedby="browse-zip-hint" />
            <p id="browse-zip-hint" className="mt-1 text-xs text-muted-foreground" aria-live="polite">
              {place.valid && place.county ? (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <MapPin className="h-3 w-3" aria-hidden="true" /> {t('wizard.zipFound', { county: place.county })}
                </span>
              ) : (
                t('browse.zipHint')
              )}
            </p>
          </div>
          <div>
            <label htmlFor="browse-search" className="text-sm font-semibold">
              {t('filters.search')}
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="browse-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('filters.title')}>
          <Chip selected={!cats.length} onClick={() => setCats([])}>
            {t('filters.all')}
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} selected={cats.includes(c)} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>
              {t(`categories.${c}`)}
            </Chip>
          ))}
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft p-4">
        <p className="font-medium">{t('browse.getPlan')}</p>
        <Button as={Link} to="/" size="sm">
          {t('browse.getPlanCta')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mt-6">
          {t('common.error')}
        </Alert>
      )}
      {!all && !error && (
        <div className="mt-6 grid gap-4">
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} className="h-40" />
          ))}
        </div>
      )}
      {all && (
        <>
          <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
            {t('browse.results', { count: results.length })}
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {results.slice(0, limit).map(({ r, d }) => (
              <ResourceCard key={r.id} resource={r} match={d != null ? { distance: d } : null} headingLevel={2} />
            ))}
          </div>
          {!results.length && <p className="mt-6 text-center text-muted-foreground">{t('browse.empty')}</p>}
          {results.length > limit && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                {t('browse.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
