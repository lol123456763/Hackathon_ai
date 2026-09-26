import { Package } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { hhmmLabel } from '@/lib/format';
import { Badge, Card } from '@/components/ui';

export default function MyPosts() {
  const { t, lang } = useI18n();
  const { live, identity } = useApp();
  const posts = (live?.donations || []).filter((d) => d.giver_key === identity).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-extrabold">{t('give.myPosts')}</h1>
      {!posts.length && (
        <Card className="flex items-center gap-3 p-4 text-muted-foreground">
          <Package className="h-6 w-6" aria-hidden="true" /> {t('give.noPosts')}
        </Card>
      )}
      <ul className="space-y-3">
        {posts.map((d, i) => (
          <li key={d.key}>
            <Card kind="tag" tilt={[1, 2, 3][i % 3]} className="overflow-hidden p-4">
              {d.status !== 'posted' && (
                <span className="stamp slap pointer-events-none absolute bottom-3 right-4 text-lg text-primary" style={{ '--r': `${[-8, 5, -3, 7][i % 4]}deg` }} aria-hidden="true">
                  {d.status === 'delivered' ? t('give.stamp.delivered') : t('give.stamp.claimed')}
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{d.items.map((i) => (lang === 'es' ? i.name_es : i.name_en)).join(', ')}</p>
                  <p className="text-sm text-muted-foreground">
                    ~{Math.round(d.confirmed_lbs || d.total_lbs)} lbs · {hhmmLabel(d.pickup_start, lang)}–{hhmmLabel(d.pickup_end, lang)}
                    {d.sample && ` · ${t('demo.sample')}`}
                  </p>
                </div>
                <Badge variant={d.status === 'delivered' ? 'success' : d.status === 'posted' ? 'accent' : 'primary'} className={d.status !== 'posted' ? 'sr-only' : undefined}>{t(`give.status.${d.status}`)}</Badge>
              </div>
              {['posted', 'matched'].includes(d.status) && d.pickup_code && (
                <p className="mt-2 text-sm">
                  {t('give.code')}: <span className="font-mono text-lg font-extrabold tracking-widest">{d.pickup_code}</span>
                </p>
              )}
              {d.volunteers?.length > 0 && <p className="mt-1 text-sm">{t('give.carriedBy', { names: d.volunteers.map((v) => v.name).join(' & '), team: d.volunteers[0].team })}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
