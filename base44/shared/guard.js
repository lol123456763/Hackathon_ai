// "Unsupported fact" guard (ported from the original BenefitBridge server by Deepam M.).
// AI text may rephrase, but any URL, phone number or dollar amount it contains must appear in the
// source data we gave it. Otherwise the AI output is rejected and a fallback is used.

const FACT_TOKENS = /https?:\/\/[^\s)"']+|\$\s?\d[\d,.]*|\+?\d[\d\s().-]{6,}\d/g;

const digits = (s) => s.replace(/\D/g, '');

/** Returns the facts in `text` that are not supported by `sourceText` (empty array = OK). */
export function unsupportedFacts(text, sourceText) {
  const source = String(sourceText || '');
  const sourceDigits = digits(source);
  const found = String(text || '').match(FACT_TOKENS) || [];
  return found
    .map((tok) => tok.replace(/[.,;:!?]+$/, ''))
    .filter((tok) => {
      if (/^https?:\/\//.test(tok)) return !source.includes(tok.replace(/\/$/, ''));
      if (tok.startsWith('$')) return !source.includes(tok.replace(/\s/g, ''));
      const d = digits(tok);
      // Phone-like numbers: compare digits only so "(512) 555-1234" matches "512-555-1234".
      return d.length >= 7 && !sourceDigits.includes(d.slice(-10));
    });
}

/** Collects every string inside a value (for checking whole AI JSON objects). */
export function allText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(allText).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(allText).join(' ');
  return '';
}
