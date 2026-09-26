// The Loop logo: two arcs, teal (help) and coral (action). When `closed`, the arcs rotate together
// into one full ring and a check mark draws in (900 ms) — the signature "loop closes" moment.
import { useEffect, useState } from 'react';
import { cn } from './ui';

const R = 19;
const C = 2 * Math.PI * R; // ≈ 119.4

export default function LoopRing({ closed = false, animate = false, size = 36, className, title }) {
  // `animate` plays the closing transition after mount (used on the TONIGHT card and celebration).
  const [isClosed, setIsClosed] = useState(closed && !animate);
  useEffect(() => {
    if (!closed) {
      setIsClosed(false);
      return undefined;
    }
    if (!animate) {
      setIsClosed(true);
      return undefined;
    }
    const id = setTimeout(() => setIsClosed(true), 120);
    return () => clearTimeout(id);
  }, [closed, animate]);

  const open = C * 0.43;
  const full = C * 0.5 + 0.5;
  const dash = isClosed ? `${full} ${C}` : `${open} ${C}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn(isClosed && 'loop-closed', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <circle className="loop-arc" cx="32" cy="32" r={R} fill="none" stroke="#0F766E" strokeWidth="8" strokeLinecap={isClosed ? 'butt' : 'round'} strokeDasharray={dash} style={{ transform: `rotate(${isClosed ? -90 : -100}deg)` }} />
      <circle className="loop-arc" cx="32" cy="32" r={R} fill="none" stroke="#C2410C" strokeWidth="8" strokeLinecap={isClosed ? 'butt' : 'round'} strokeDasharray={dash} style={{ transform: `rotate(${isClosed ? 90 : 80}deg)` }} />
      <path className="loop-check" d="M23 33 l6 6 l12 -13" fill="none" stroke="#15803D" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
