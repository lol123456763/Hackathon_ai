import TX_ZIPS from './data/tx-zips.js';

// Texas ZIP codes start with 75-79 or 885 (El Paso area).
export function isTexasZipPrefix(zip) {
  return /^(7[5-9]\d{3}|885\d{2})$/.test(zip);
}

// 3-digit ZIP prefix ranges → state (USPS). Used to decide which state programs apply.
const PREFIX_STATES = [
  [5, 5, 'NY'], [6, 7, 'PR'], [8, 8, 'VI'], [9, 9, 'PR'], [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'], [50, 54, 'VT'], [55, 55, 'MA'],
  [56, 59, 'VT'], [60, 69, 'CT'], [70, 89, 'NJ'], [90, 99, 'AE'], [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'], [200, 200, 'DC'], [201, 201, 'VA'],
  [202, 205, 'DC'], [206, 219, 'MD'], [220, 246, 'VA'], [247, 268, 'WV'], [270, 289, 'NC'], [290, 299, 'SC'], [300, 319, 'GA'], [320, 349, 'FL'],
  [350, 369, 'AL'], [370, 385, 'TN'], [386, 397, 'MS'], [398, 399, 'GA'], [400, 427, 'KY'], [430, 459, 'OH'], [460, 479, 'IN'], [480, 499, 'MI'],
  [500, 528, 'IA'], [530, 549, 'WI'], [550, 567, 'MN'], [569, 569, 'DC'], [570, 577, 'SD'], [580, 588, 'ND'], [590, 599, 'MT'], [600, 629, 'IL'],
  [630, 658, 'MO'], [660, 679, 'KS'], [680, 693, 'NE'], [700, 714, 'LA'], [716, 729, 'AR'], [730, 749, 'OK'], [750, 799, 'TX'], [800, 816, 'CO'],
  [820, 831, 'WY'], [832, 838, 'ID'], [840, 847, 'UT'], [850, 865, 'AZ'], [870, 884, 'NM'], [885, 885, 'TX'], [889, 898, 'NV'], [900, 961, 'CA'],
  [962, 966, 'AP'], [967, 968, 'HI'], [969, 969, 'GU'], [970, 979, 'OR'], [980, 994, 'WA'], [995, 999, 'AK'],
];

export function stateForZip(zip) {
  if (!/^\d{5}$/.test(String(zip || ''))) return null;
  const p = Number(String(zip).slice(0, 3));
  const hit = PREFIX_STATES.find(([a, b]) => p >= a && p <= b);
  return hit ? hit[2] : null;
}

export function isValidZip(zip) {
  // A real ZIP must be 5 digits and map to a state (rejects 00000, 00100, etc.).
  return typeof zip === 'string' && /^\d{5}$/.test(zip) && stateForZip(zip) !== null;
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
  const base = { zip, valid: isValidZip(zip), state: stateForZip(zip), inTexas: false, county: null, counties: [], lat: null, lng: null, approximate: false };
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
