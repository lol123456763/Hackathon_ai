// Neighborhood map (Leaflet + OpenStreetMap). Open requests are NEVER shown as pins — only as a
// "families waiting" count on their hub.
import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useI18n } from '@/i18n';
import { DEMO } from '@shared/constants.js';
import { cn } from './ui';

const COLORS = { hub: '#0E7C74', giver: '#E8503A', event: '#E0A21B', mission: '#E8503A', done: '#1F7A4D' };

export default function LiveMap({ live, height = 320, className, focus }) {
  const { t, lang } = useI18n();
  const [layers, setLayers] = useState({ hubs: true, givers: true, missions: true, events: true });
  const center = focus ? [focus.lat, focus.lng] : [DEMO.center.lat, DEMO.center.lng];

  const recentLines = useMemo(() => {
    if (!live) return [];
    const nowIso = Date.now() - 15 * 60000;
    return live.activity.filter((a) => a.line && Date.parse(a.at) > nowIso).slice(0, 3);
  }, [live]);

  if (!live) return <div className={cn('skeleton', className)} style={{ height }} />;
  const activeMissions = live.missions.filter((m) => ['open', 'claimed', 'picked_up'].includes(m.status) && m.giver && m.hub);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border', className)} style={{ height }}>
      <MapContainer center={center} zoom={DEMO.zoom} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {layers.events &&
          live.events.map((e) => (
            <CircleMarker key={e.key} center={[e.lat + 0.0012, e.lng + 0.0012]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: COLORS.event, fillOpacity: 1 }}>
              <Tooltip direction="top">{lang === 'es' ? e.title_es : e.title_en}</Tooltip>
            </CircleMarker>
          ))}
        {layers.missions &&
          activeMissions.map((m) => (
            <Polyline key={m.key} positions={[[m.giver.lat, m.giver.lng], [m.hub.lat, m.hub.lng]]} pathOptions={{ color: m.status === 'open' ? COLORS.mission : COLORS.done, weight: 4, className: 'draw-line', opacity: 0.9 }}>
              <Tooltip>{lang === 'es' ? m.title_es : m.title_en}</Tooltip>
            </Polyline>
          ))}
        {layers.missions &&
          recentLines.map((a) => (
            <Polyline key={`l-${a.id}`} positions={[[a.line.from.lat, a.line.from.lng], [a.line.to.lat, a.line.to.lng]]} pathOptions={{ color: COLORS.giver, weight: 3, className: 'draw-line', opacity: 0.6 }} />
          ))}

        {layers.hubs &&
          live.hubs.map((h) => (
            <CircleMarker key={h.key} center={[h.lat, h.lng]} radius={12} pathOptions={{ color: '#fff', weight: 3, fillColor: COLORS.hub, fillOpacity: 1 }}>
              <Tooltip direction="top" offset={[0, -10]} permanent={h.waiting > 0 || h.ready > 0}>
                <span className="font-semibold">{h.name}</span>
                {h.waiting > 0 && <span> · {h.waiting === 1 ? t('hub.waitingOne') : t('hub.waiting', { count: h.waiting })}</span>}
              </Tooltip>
              <Popup>
                <strong>{h.name}</strong>
                <br />
                {lang === 'es' ? h.hours_text_es : h.hours_text_en}
              </Popup>
            </CircleMarker>
          ))}

        {layers.givers &&
          live.givers
            .filter((g) => g.open_lbs > 0)
            .map((g) => (
              <CircleMarker key={g.key} center={[g.lat, g.lng]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: COLORS.giver, fillOpacity: 1 }}>
                <Tooltip direction="top" offset={[0, -8]}>
                  {g.name} · {t('map.lbsOpen', { lbs: Math.round(g.open_lbs) })}
                </Tooltip>
              </CircleMarker>
            ))}

      </MapContainer>

      <div className="absolute right-2 top-2 z-[500] flex max-w-[75%] flex-wrap justify-end gap-1" role="group" aria-label="Map layers">
        {Object.keys(layers).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={layers[k]}
            onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
            className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold shadow-soft', layers[k] ? 'border-transparent bg-card text-foreground' : 'bg-card/70 text-muted-foreground line-through')}
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: { hubs: COLORS.hub, givers: COLORS.giver, missions: COLORS.mission, events: COLORS.event }[k] }} />
            {t(`map.layers.${k}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
