// Hand-made details: a marker underline, a scribbled circle, a doodle arrow, a handwritten note, and
// Loopy the mascot. All decorative (aria-hidden) and still under prefers-reduced-motion.
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from './ui';

/** Marker underline drawn under a word: <Squiggle>tonight</Squiggle> */
export function Squiggle({ children, color = 'hsl(var(--accent))', className }) {
  return (
    <span className={cn('relative inline-block whitespace-nowrap', className)}>
      <span className="relative z-10">{children}</span>
      <svg aria-hidden="true" viewBox="0 0 200 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 z-0 h-3.5 w-full overflow-visible">
        <path className="draw-in" d="M3 12 C 30 5, 58 15, 84 9 S 138 5, 162 10 S 188 12, 197 7" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Loose pen circle around something important. */
export function Scribble({ children, color = 'hsl(var(--accent))', className }) {
  return (
    <span className={cn('relative inline-block px-1', className)}>
      <span className="relative z-10">{children}</span>
      <svg aria-hidden="true" viewBox="0 0 120 60" preserveAspectRatio="none" className="absolute -inset-x-2 -inset-y-2 z-0 h-[calc(100%+16px)] w-[calc(100%+16px)] overflow-visible">
        <path className="draw-in" d="M22 9 C 70 0, 117 11, 113 32 C 109 55, 32 59, 11 42 C -3 29, 18 9, 62 5" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function DoodleArrow({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 80 50" className={cn('h-10 w-16 text-accent', className)}>
      <path className="draw-in" d="M4 6 C 20 40, 45 44, 70 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path className="draw-in" d="M58 24 L 71 30 L 62 41" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A handwritten margin note. Use at most one per screen. */
export function Note({ children, className, as: Comp = 'p' }) {
  return <Comp className={cn('hand text-[19px] leading-tight text-accent-deep', className)}>{children}</Comp>;
}

const INK = '#1B1A17';
const TEAL = '#14A394';
const TEAL_SHADE = '#0E7C74';
const SCARF = '#E8503A';

/**
 * Loopy — Loop's mascot: a teal bean with a coral scarf, printed like a risograph (ink outline over a
 * slightly offset color fill). Blinks now and then; squashes when tapped.
 * mood: 'wave' | 'happy' | 'think' | 'cheer' | 'sleep' | 'carry'
 */
export function Loopy({ mood = 'wave', size = 72, className }) {
  const reduce = useReducedMotion();
  const [boing, setBoing] = useState(0);
  const eyes = mood === 'happy' || mood === 'cheer' ? 'arc' : mood === 'sleep' ? 'line' : 'dot';
  const body = 'M58 16 C 86 13, 104 34, 103 62 C 102 92, 84 107, 58 106 C 32 105, 16 90, 17 62 C 18 34, 32 18, 58 16 Z';
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      key={boing}
      initial={reduce || !boing ? false : { scaleX: 1.14, scaleY: 0.86 }}
      animate={{ scaleX: 1, scaleY: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 9 }}
      style={{ transformOrigin: '60px 106px' }}
      onPointerDown={() => setBoing((b) => b + 1)}
    >
      {/* feet */}
      <path d="M44 106 q -2 8 -9 8 M74 106 q 2 8 9 8" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      {/* body: flat fill, nudged out of register, then the ink line */}
      <path d={body} fill={TEAL} transform="translate(3 3)" />
      <path d="M26 74 C 32 96, 70 104, 92 84 C 88 100, 72 106, 58 106 C 40 106, 28 94, 26 74 Z" fill={TEAL_SHADE} transform="translate(3 3)" opacity=".55" />
      <path d={body} fill="none" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
      {/* scarf with a loose end */}
      <path d="M22 70 C 42 80, 76 81, 99 68" fill="none" stroke={SCARF} strokeWidth="10" strokeLinecap="round" />
      <path d="M84 76 C 88 86, 86 94, 92 100" fill="none" stroke={SCARF} strokeWidth="8" strokeLinecap="round" />
      <path d="M22 66 C 42 76, 76 77, 99 64" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".5" />
      {/* cheeks */}
      <circle cx="37" cy="58" r="5" fill="#FF9E8A" opacity=".85" />
      <circle cx="81" cy="58" r="5" fill="#FF9E8A" opacity=".85" />
      {/* eyes */}
      {eyes === 'dot' && (
        <motion.g
          animate={reduce ? {} : { scaleY: [1, 1, 0.12, 1] }}
          transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.92, 0.96, 1] }}
          style={{ transformOrigin: '59px 46px' }}
        >
          <ellipse cx="46" cy="46" rx="4.6" ry="5.6" fill={INK} />
          <ellipse cx="72" cy="46" rx="4.6" ry="5.6" fill={INK} />
          <circle cx="47.6" cy="44" r="1.6" fill="#fff" />
          <circle cx="73.6" cy="44" r="1.6" fill="#fff" />
        </motion.g>
      )}
      {eyes === 'arc' && (
        <g fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round">
          <path d="M40 48 Q 46 40 52 48" />
          <path d="M66 48 Q 72 40 78 48" />
        </g>
      )}
      {eyes === 'line' && (
        <g stroke={INK} strokeWidth="3.4" strokeLinecap="round">
          <path d="M41 47 Q 46 50 51 47" fill="none" />
          <path d="M67 47 Q 72 50 77 47" fill="none" />
        </g>
      )}
      {/* mouth */}
      {mood === 'think' && <path d="M52 58 Q 58 55 66 59" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {mood === 'sleep' && <ellipse cx="59" cy="58" rx="3" ry="3.6" fill={INK} />}
      {mood === 'cheer' && <path d="M49 55 Q 59 70 69 55 Z" fill={INK} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />}
      {(mood === 'wave' || mood === 'happy' || mood === 'carry') && <path d="M51 56 Q 59 63 67 56" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {/* arms / props */}
      {mood === 'wave' && (
        <motion.path
          d="M101 60 C 110 54, 114 44, 110 35"
          fill="none"
          stroke={INK}
          strokeWidth="3.6"
          strokeLinecap="round"
          initial={false}
          animate={reduce ? {} : { rotate: [0, 22, -4, 22, 0] }}
          transition={{ duration: 1.3, delay: 0.4 }}
          style={{ transformOrigin: '101px 60px' }}
        />
      )}
      {mood === 'cheer' && (
        <g fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round">
          <path d="M19 58 C 10 50, 8 40, 12 30" />
          <path d="M101 58 C 110 50, 112 40, 108 30" />
        </g>
      )}
      {mood === 'think' && <path d="M88 26 c 0 -8 12 -8 12 0 c 0 5 -6 5 -6 10 M94 42 v.5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {mood === 'sleep' && <path d="M92 22 h8 l-8 9 h8 M104 10 h6 l-6 7 h6" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
      {mood === 'carry' && (
        <g>
          <path d="M92 70 h22 l-3 26 h-16 z" fill="#E9C99A" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M98 70 c 0 -7 10 -7 10 0" fill="none" stroke={INK} strokeWidth="3" />
          <path d="M100 66 c 2 -6 6 -8 9 -6" fill="none" stroke="#3E8E41" strokeWidth="3" strokeLinecap="round" />
          <path d="M101 70 C 98 72, 96 74, 96 76" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        </g>
      )}
    </motion.svg>
  );
}
