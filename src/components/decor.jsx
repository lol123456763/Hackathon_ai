// Hand-made decoration: squiggles, wavy dividers, drifting blobs, doodles and Loopy the mascot.
// Purely decorative (aria-hidden) and calm under prefers-reduced-motion.
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from './ui';

/** Hand-drawn underline that draws itself in. Wrap a word: <Squiggle>tonight</Squiggle> */
export function Squiggle({ children, color = 'hsl(var(--accent))', className }) {
  return (
    <span className={cn('relative inline-block whitespace-nowrap', className)}>
      <span className="relative z-10">{children}</span>
      <svg aria-hidden="true" viewBox="0 0 200 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 z-0 h-3.5 w-full overflow-visible">
        <path className="draw-in" d="M3 12 C 30 3, 55 17, 82 9 S 135 3, 160 10 S 190 14, 197 6" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Loose hand-drawn circle around something important. */
export function Scribble({ children, color = 'hsl(var(--primary))', className }) {
  return (
    <span className={cn('relative inline-block px-1', className)}>
      <span className="relative z-10">{children}</span>
      <svg aria-hidden="true" viewBox="0 0 120 60" preserveAspectRatio="none" className="absolute -inset-x-2 -inset-y-2 z-0 h-[calc(100%+16px)] w-[calc(100%+16px)] overflow-visible">
        <path className="draw-in" d="M20 8 C 70 -2, 118 10, 114 32 C 110 56, 30 60, 10 42 C -4 28, 20 8, 60 6" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function WavyDivider({ className, color = 'hsl(var(--border))' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 16" preserveAspectRatio="none" className={cn('my-2 h-3 w-full', className)}>
      <path d="M0 8 Q 25 0 50 8 T 100 8 T 150 8 T 200 8 T 250 8 T 300 8 T 350 8 T 400 8" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Soft morphing blobs that drift behind the app. */
export function BlobBackdrop({ className }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute -left-24 -top-24 h-80 w-80 animate-morph bg-primary/20 blur-3xl motion-safe:animate-drift" />
      <div className="absolute -right-20 top-1/3 h-72 w-72 animate-morph bg-accent/20 blur-3xl [animation-delay:-6s] motion-safe:animate-drift" />
      <div className="absolute -bottom-24 left-1/4 h-80 w-96 animate-morph bg-amber-300/25 blur-3xl [animation-delay:-11s] motion-safe:animate-drift dark:bg-amber-500/10" />
    </div>
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

export function Sparkles({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className={cn('h-6 w-6 text-amber-400', className)}>
      <path d="M20 2 L23 16 L38 20 L23 24 L20 38 L17 24 L2 20 L17 16 Z" fill="currentColor" className="origin-center motion-safe:animate-wiggle-slow" />
    </svg>
  );
}

/**
 * Loopy — a squishy blob made of Loop's two colors.
 * mood: 'wave' | 'happy' | 'think' | 'cheer' | 'sleep'
 */
export function Loopy({ mood = 'wave', size = 72, className }) {
  const reduce = useReducedMotion();
  const bob = reduce ? {} : { y: [0, -6, 0], rotate: mood === 'cheer' ? [0, -8, 8, 0] : [0, -2, 2, 0] };
  const eyes = mood === 'happy' || mood === 'cheer' ? 'arc' : mood === 'sleep' ? 'line' : 'dot';
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn('overflow-visible drop-shadow-md', className)}
      animate={bob}
      transition={{ duration: mood === 'cheer' ? 0.9 : 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id="loopy-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      <motion.path
        d="M60 12 C 92 10, 112 36, 108 66 C 104 98, 80 110, 56 108 C 28 106, 10 88, 12 60 C 14 32, 32 14, 60 12 Z"
        fill="url(#loopy-g)"
        animate={reduce ? {} : { d: ['M60 12 C 92 10, 112 36, 108 66 C 104 98, 80 110, 56 108 C 28 106, 10 88, 12 60 C 14 32, 32 14, 60 12 Z', 'M58 14 C 94 12, 110 40, 106 68 C 102 96, 82 108, 58 110 C 26 108, 12 86, 14 58 C 16 30, 30 16, 58 14 Z', 'M60 12 C 92 10, 112 36, 108 66 C 104 98, 80 110, 56 108 C 28 106, 10 88, 12 60 C 14 32, 32 14, 60 12 Z'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* coral scarf = the second half of the loop */}
      <path d="M22 78 C 40 92, 78 94, 100 76" fill="none" stroke="#F97316" strokeWidth="9" strokeLinecap="round" />
      {/* cheeks */}
      <circle cx="36" cy="66" r="6" fill="#FDA4AF" opacity=".8" />
      <circle cx="84" cy="66" r="6" fill="#FDA4AF" opacity=".8" />
      {/* eyes */}
      {eyes === 'dot' && (
        <motion.g animate={reduce ? {} : { scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.9, 0.95, 1] }} style={{ transformOrigin: '60px 52px' }}>
          <circle cx="45" cy="52" r="6" fill="#0B1220" />
          <circle cx="75" cy="52" r="6" fill="#0B1220" />
          <circle cx="47" cy="50" r="2" fill="#fff" />
          <circle cx="77" cy="50" r="2" fill="#fff" />
        </motion.g>
      )}
      {eyes === 'arc' && (
        <g fill="none" stroke="#0B1220" strokeWidth="4" strokeLinecap="round">
          <path d="M39 54 Q 45 46 51 54" />
          <path d="M69 54 Q 75 46 81 54" />
        </g>
      )}
      {eyes === 'line' && (
        <g stroke="#0B1220" strokeWidth="4" strokeLinecap="round">
          <path d="M39 53 H 51" />
          <path d="M69 53 H 81" />
        </g>
      )}
      {/* mouth */}
      {mood === 'think' ? <path d="M52 68 Q 60 66 68 70" fill="none" stroke="#0B1220" strokeWidth="3.5" strokeLinecap="round" /> : <path d={mood === 'cheer' ? 'M48 64 Q 60 80 72 64 Z' : 'M50 65 Q 60 74 70 65'} fill={mood === 'cheer' ? '#0B1220' : 'none'} stroke="#0B1220" strokeWidth="3.5" strokeLinecap="round" />}
      {/* waving arm */}
      {mood === 'wave' && (
        <motion.path
          d="M104 56 C 114 48, 118 38, 114 30"
          fill="none"
          stroke="#0F766E"
          strokeWidth="8"
          strokeLinecap="round"
          animate={reduce ? {} : { rotate: [0, 18, -6, 18, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2 }}
          style={{ transformOrigin: '104px 56px' }}
        />
      )}
      {mood === 'cheer' && (
        <g fill="#FACC15">
          <path d="M16 18 l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
          <path d="M104 10 l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </g>
      )}
    </motion.svg>
  );
}

/** Children fade/slide in one after another. */
export function Stagger({ children, className, delay = 0.06, as = 'div' }) {
  const reduce = useReducedMotion();
  const Comp = motion[as] || motion.div;
  return (
    <Comp className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : delay } } }}>
      {children}
    </Comp>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 14, rotate: -1 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 380, damping: 26 } },
};

export function StaggerItem({ children, className, as = 'div', ...props }) {
  const Comp = motion[as] || motion.div;
  return (
    <Comp className={className} variants={staggerItem} {...props}>
      {children}
    </Comp>
  );
}
