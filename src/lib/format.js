// Display helpers.
export function hhmmLabel(hhmm, lang = 'en') {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return hhmm || '';
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2]))));
}

export function fmtHours(h) {
  const n = Math.round(Number(h || 0) * 100) / 100;
  return String(n);
}
