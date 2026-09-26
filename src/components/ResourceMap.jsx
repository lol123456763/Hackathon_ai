// Map of matched resources (approximate locations by ZIP centroid). Loaded lazily.
import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useI18n } from '@/i18n';
import { resourceLocation } from '@shared/zip.js';
import { telHref } from './ResourceCard';

export default function ResourceMap({ place, items }) {
  const { t, field } = useI18n();

  const points = useMemo(() => {
    // Group resources that share a ZIP so their markers do not hide each other.
    const groups = new Map();
    for (const { resource, match } of items) {
      const loc = resourceLocation(resource);
      if (!loc) continue;
      const key = `${loc.lat},${loc.lng}`;
      if (!groups.has(key)) groups.set(key, { loc, list: [] });
      groups.get(key).list.push({ resource, match });
    }
    return [...groups.values()];
  }, [items]);

  if (!points.length) return <p className="rounded-xl bg-muted p-4 text-muted-foreground">{t('map.none')}</p>;

  const center = place?.lat != null ? [place.lat, place.lng] : [points[0].loc.lat, points[0].loc.lng];

  return (
    <div>
      <div className="h-[420px] overflow-hidden rounded-xl border sm:h-[520px]">
        <MapContainer center={center} zoom={10} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {place?.lat != null && (
            <CircleMarker center={[place.lat, place.lng]} radius={10} pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.9 }}>
              <Tooltip permanent direction="top">{t('map.you')}</Tooltip>
            </CircleMarker>
          )}
          {points.map(({ loc, list }) => (
            <CircleMarker key={`${loc.lat},${loc.lng}`} center={[loc.lat, loc.lng]} radius={8 + Math.min(list.length, 6)} pathOptions={{ color: '#0F766E', fillColor: '#0F766E', fillOpacity: 0.75 }}>
              <Popup>
                <ul className="m-0 max-h-60 list-none space-y-2 overflow-auto p-0">
                  {list.map(({ resource: r }) => (
                    <li key={r.id}>
                      <strong>{r.name}</strong>
                      <br />
                      <span>{field(r, 'description').slice(0, 120)}</span>
                      {r.phone && (
                        <>
                          <br />
                          <a href={telHref(r.phone)}>{r.phone}</a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{t('map.note')}</p>
    </div>
  );
}
