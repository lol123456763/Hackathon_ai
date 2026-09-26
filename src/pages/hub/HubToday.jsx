import { Truck, ShieldAlert, PackageCheck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { formatTime } from '@shared/time.js';
import { Badge, Card } from '@/components/ui';
import LoopRing from '@/components/LoopRing';

export default function HubToday() {
  const { t, lang } = useI18n();
  const { live, identity } = useApp();
  const hub = live?.hubs.find((h) => h.key === identity);
  const view = live?.hub_view;
  if (!live || !hub) return <div className="skeleton mt-4 h-64" />;
  return (
    <div className="space-y-4 pt-2">
      <div>
        <h1 className="text-2xl font-extrabold">{hub.name}</h1>
        <p className="text-sm text-muted-foreground">
          {hub.area_label} · {lang === 'es' ? hub.hours_text_es : hub.hours_text_en}
        </p>
      </div>

      <Card className="p-5 text-center">
        <div className="flex items-center justify-center gap-2">
          <LoopRing size={32} />
          <p className="font-bold">{t('hub.dropCode')}</p>
        </div>
        <p className="mt-2 font-mono text-6xl font-extrabold tracking-[0.25em] text-primary">{hub.drop_code}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('hub.dropHint')}</p>
      </Card>

      {view?.alerts?.length > 0 && (
        <Card className="border-danger/40 p-4">
          <h2 className="flex items-center gap-2 font-extrabold text-danger">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" /> {t('hub.alerts')}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {view.alerts.map((a) => (
              <li key={a.at}>
                {formatTime(Date.parse(a.at), lang)} · {lang === 'es' ? a.message_es : a.message_en}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="incoming-title">
        <h2 id="incoming-title" className="mb-2 flex items-center gap-2 text-lg font-extrabold">
          <Truck className="h-5 w-5 text-primary" aria-hidden="true" /> {t('hub.incoming')}
        </h2>
        {!view?.incoming.length ? (
          <Card className="p-4 text-muted-foreground">{t('hub.noIncoming')}</Card>
        ) : (
          <ul className="space-y-2">
            {view.incoming.map((m) => (
              <li key={m.key}>
                <Card className="p-3">
                  <p className="font-semibold">{lang === 'es' ? m.title_es : m.title_en}</p>
                  <p className="text-sm text-muted-foreground">
                    ~{m.lbs} lbs · {t(`hub.status.${m.status}`)}
                    {m.volunteer_names?.length > 0 && ` · ${m.volunteer_names.join(' & ')}`}
                    {m.eta_minutes != null && ` · ${t('hub.eta', { min: m.eta_minutes })}`}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="shelf-title">
        <h2 id="shelf-title" className="mb-2 flex items-center gap-2 text-lg font-extrabold">
          <PackageCheck className="h-5 w-5 text-primary" aria-hidden="true" /> {t('hub.shelf')}
        </h2>
        {!view?.shelf.length ? (
          <Card className="p-4 text-muted-foreground">{t('hub.shelfEmpty')}</Card>
        ) : (
          <ul className="space-y-2">
            {view.shelf.map((b) => (
              <li key={b.code}>
                <Card className="flex items-center justify-between gap-2 p-3">
                  <span className="font-mono text-lg font-extrabold">{b.code}</span>
                  {b.status === 'ready' && <Badge variant="accent">{t('hub.readySince', { time: formatTime(b.ready_at, lang) })}</Badge>}
                  {b.status === 'picked_up' && <Badge variant="success">{t('hub.pickedUp')}</Badge>}
                  {b.status === 'on_the_way' && <Badge variant="primary">{t('hub.onTheWay')}</Badge>}
                  {b.status === 'expired' && <Badge>{t('hub.expired')}</Badge>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
