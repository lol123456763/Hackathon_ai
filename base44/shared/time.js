// Demo clock. Every "Reset demo" starts the neighborhood clock at 5:05 PM Central time (today),
// and it then advances in real time. This keeps the golden path identical whenever it is shown
// (pickup windows, "needed by 7 PM", age-based time limits) — even when the demo runs at 10 AM.
import { DEMO } from './constants.js';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: DEMO.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** Wall-clock parts of an instant in Central time. */
export function centralParts(ms) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second, weekday: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() };
}

/** Epoch ms for a Central-time wall clock (handles daylight saving time). */
export function centralToEpoch(year, month, day, hour, minute) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    const p = centralParts(guess);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const diff = asUtc - Date.UTC(year, month - 1, day, hour, minute);
    if (diff === 0) break;
    guess -= diff;
  }
  return guess;
}

/** The demo-clock offset (ms) to add to real time, given when the demo was reset. */
export function demoOffset(resetAtMs) {
  const p = centralParts(resetAtMs);
  const start = centralToEpoch(p.year, p.month, p.day, DEMO.clockStart.hour, DEMO.clockStart.minute);
  return start - resetAtMs;
}

export function makeClock(resetAtMs, realNow = Date.now()) {
  const offset = resetAtMs ? demoOffset(resetAtMs) : 0;
  const now = realNow + offset;
  const today = centralParts(now);
  return {
    offset,
    now,
    today,
    /** Epoch ms for HH:MM today (demo day, Central time). */
    at(hour, minute = 0) {
      return centralToEpoch(today.year, today.month, today.day, hour, minute);
    },
    /** Minutes since Central midnight for an epoch. */
    minutesOf(ms) {
      const p = centralParts(ms);
      return p.hour * 60 + p.minute;
    },
  };
}

export function formatTime(ms, lang = 'en') {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { timeZone: DEMO.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
}

export function hhmmToMinutes(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function minutesToHhmm(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
