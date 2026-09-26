// A hand-drawn route from the business to the hub. The dashed string inks in as the mission moves along,
// and a little bag rides the line to where the food is now.
import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from './icons';

const PROGRESS = { open: 0, claimed: 0.12, picked_up: 0.62, delivered: 1 };
const D = 'M28 44 C 70 8, 108 70, 150 38 S 230 10, 262 40 S 300 60, 312 36';

export default function RouteString({ status, from, to }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const p = PROGRESS[status] ?? 0;
  const [pt, setPt] = useState({ x: 28, y: 44 });
  useLayoutEffect(() => {
    const path = ref.current;
    if (!path?.getTotalLength) return;
    const at = path.getPointAtLength(path.getTotalLength() * p);
    setPt({ x: at.x, y: at.y });
  }, [p]);
  return (
    <figure className="relative" aria-hidden="true">
      <svg viewBox="0 0 340 80" className="h-auto w-full overflow-visible">
        <path ref={ref} d={D} fill="none" stroke="hsl(var(--ink) / 0.25)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
        <motion.path
          d={D}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="4"
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: p }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.65, 0, 0.35, 1] }}
        />
        <motion.g initial={false} animate={{ x: pt.x - 13, y: pt.y - 30 }} transition={{ duration: reduce ? 0 : 0.9, ease: [0.65, 0, 0.35, 1] }}>
          <path d="M3 10 h20 l-3 16 h-14 z" fill="#E9C99A" stroke="hsl(var(--ink))" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M8 10 c 0 -6 10 -6 10 0" fill="none" stroke="hsl(var(--ink))" strokeWidth="2.2" />
        </motion.g>
        <foreignObject x="4" y="46" width="48" height="34">
          <Icon name="post" tone="tomato" className="h-7 w-7" />
        </foreignObject>
        <foreignObject x="296" y="40" width="44" height="40">
          <Icon name="home" tone="teal" className="h-8 w-8" />
        </foreignObject>
      </svg>
      <figcaption className="-mt-1 flex justify-between text-[11px] font-bold text-muted-foreground">
        <span>{from}</span>
        <span className="text-right">{to}</span>
      </figcaption>
    </figure>
  );
}
