import TX_ZIPS from './data/tx-zips.js';

// Texas ZIP codes start with 75-79 or 885 (El Paso area).
export function isTexasZipPrefix(zip) {
  return /^(7[5-9]\d{3}|885\d{2})$/.test(zip);
}

export function isValidZip(zip) {
  return typeof zip === 'string' && /^\d{5}$/.test(zip);
}

let prefixIndex = null;

// For ZIPs that are not in the Census ZCTA list (PO-box-only ZIPs, new ZIPs), fall back to the
// most common county among known ZIPs sharing the same first 3 digits.
function buildPrefixIndex() {
  const counts = {};
  const coords = {};
  for (const [zip, [county, lat, lng]] of Object.entries(TX_ZIPS)) {
    const p = zip.slice(0, 3);
    counts[p] ??= {};
    counts[p][county] = (counts[p][county] || 0) + 1;
    if (lat != null) {
      coords[p] ??= { lat: 0, lng: 0, n: 0 };
      coords[p].lat += lat;
      coords[p].lng += lng;
      coords[p].n += 1;
    }
  }
  const index = {};
  for (const [p, byCounty] of Object.entries(counts)) {
    const county = Object.entries(byCounty).sort((a, b) => b[1] - a[1])[0][0];
    const c = coords[p];
    index[p] = { county, lat: c ? c.lat / c.n : null, lng: c ? c.lng / c.n : null };
  }
  return index;
}

/**
 * Look up a ZIP code.
 * @returns {{zip:string, valid:boolean, inTexas:boolean, county:string|null, counties:string[],
 *   lat:number|null, lng:number|null, approximate:boolean}}
 */
export function lookupZip(rawZip) {
  const zip = String(rawZip ?? '').trim().slice(0, 5);
  const base = { zip, valid: isValidZip(zip), inTexas: false, county: null, counties: [], lat: null, lng: null, approximate: false };
  if (!base.valid) return base;

  const hit = TX_ZIPS[zip];
  if (hit) {
    const [county, lat, lng, ...others] = hit;
    return { ...base, inTexas: true, county, counties: [county, ...others], lat, lng };
  }
  if (!isTexasZipPrefix(zip)) return base;

  prefixIndex ??= buildPrefixIndex();
  const guess = prefixIndex[zip.slice(0, 3)];
  if (!guess) return { ...base, inTexas: true, approximate: true };
  return { ...base, inTexas: true, county: guess.county, counties: [guess.county], lat: guess.lat, lng: guess.lng, approximate: true };
}

// Great-circle distance in miles.
export function distanceMiles(a, b) {
  if (a?.lat == null || b?.lat == null) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// Approximate location of a resource: its own ZIP centroid if it has a Texas ZIP.
export function resourceLocation(resource) {
  if (resource?.lat != null && resource?.lng != null) return { lat: resource.lat, lng: resource.lng };
  if (resource?.zip) {
    const z = lookupZip(resource.zip);
    if (z.lat != null) return { lat: z.lat, lng: z.lng };
  }
  return null;
}
