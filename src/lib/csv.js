// Minimal RFC 4180 CSV helpers for the admin resource import/export.
export const RESOURCE_CSV_COLUMNS = [
  'slug', 'name', 'organization', 'categories', 'description_en', 'description_es', 'eligibility_summary_en', 'eligibility_summary_es',
  'how_to_apply_en', 'how_to_apply_es', 'documents_needed', 'apply_url', 'phone', 'address', 'city', 'zip', 'hours', 'walk_in', 'apply_online',
  'languages', 'cost', 'coverage_type', 'coverage_counties', 'source_url', 'confidence', 'is_active', 'verified_date', 'priority_weight', 'notes',
];
const LIST_FIELDS = new Set(['categories', 'documents_needed', 'languages', 'coverage_counties']);
const BOOL_FIELDS = new Set(['walk_in', 'apply_online', 'is_active']);

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  // Neutralize spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n');
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c !== ''));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

export function rowToResource(row) {
  const out = {};
  for (const [k, raw] of Object.entries(row)) {
    const v = typeof raw === 'string' ? raw.replace(/^'(?=[=+\-@])/, '').trim() : raw;
    if (LIST_FIELDS.has(k)) out[k] = v ? v.split(';').map((x) => x.trim()).filter(Boolean) : [];
    else if (BOOL_FIELDS.has(k)) out[k] = /^(true|yes|1)$/i.test(v);
    else if (k === 'priority_weight') out[k] = Number(v) || 0;
    else if (v !== '') out[k] = v;
  }
  return out;
}
