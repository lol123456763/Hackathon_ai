// Illustration from BenefitBridge: the drawn journey ribbon with two blob friends, and Loopy (the peach
// blob) on its own. Decorative only (aria-hidden); still under prefers-reduced-motion.
import { useRef } from 'react';
import { cn } from './ui';

const INK = '#215047';

/** BenefitBridge's hero art. Follows the pointer a little on desktop. */
export function JourneyArt({ className }) {
  const art = useRef(null);
  const move = (e) => {
    if (!art.current || !window.matchMedia?.('(pointer: fine)').matches || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const box = e.currentTarget.getBoundingClientRect();
    art.current.style.transform = `translate(${((e.clientX - box.left) / box.width - 0.5) * 18}px, ${((e.clientY - box.top) / box.height - 0.5) * 18}px)`;
  };
  const leave = () => art.current && (art.current.style.transform = '');
  return (
    <div className={cn('relative grid place-items-center', className)} onPointerMove={move} onPointerLeave={leave} aria-hidden="true">
      <div className="dotted-field absolute inset-[5%_0]" />
      <svg ref={art} viewBox="0 0 520 340" fill="none" className="relative w-[112%] max-w-none overflow-visible transition-transform duration-500 ease-out">
        <path d="M-25 259C45 257 51 141 125 162C183 179 159 277 244 243C317 214 256 79 352 97C407 107 407 226 544 142" stroke="rgba(247,218,140,.18)" strokeWidth="39" strokeLinecap="round" />
        <path className="art-ribbon" d="M-25 259C45 257 51 141 125 162C183 179 159 277 244 243C317 214 256 79 352 97C407 107 407 226 544 142" stroke="#f8dc92" strokeWidth="4" strokeLinecap="round" />
        <g className="art-blob">
          <path d="M89 99C111 81 147 88 155 116C166 146 145 181 116 178C87 176 69 149 75 125C78 114 82 104 89 99Z" fill="#F8B984" />
          <path d="M95 133C106 138 125 138 136 127" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <circle cx="101" cy="118" r="3" fill={INK} />
          <circle cx="132" cy="115" r="3" fill={INK} />
        </g>
        <g className="art-blob art-blob-two">
          <path d="M318 58C347 35 388 45 401 75C417 111 387 139 349 135C320 132 302 111 307 88C310 74 310 65 318 58Z" fill="#C8D6FC" />
          <path d="M335 94C343 104 365 105 375 91" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <circle cx="336" cy="78" r="3" fill={INK} />
          <circle cx="372" cy="77" r="3" fill={INK} />
        </g>
        <g className="art-spark" stroke="#F5D984" strokeWidth="5" strokeLinecap="round">
          <path d="M223 102V126M211 114H235M215 106L231 122M231 106L215 122" />
        </g>
        <g className="art-spark art-spark-two" stroke="#F5D984" strokeWidth="4" strokeLinecap="round">
          <path d="M432 63V85M421 74H443M424 66L440 82M440 66L424 82" />
        </g>
        <path className="art-loop" d="M190 275C163 309 229 320 232 287C234 267 203 262 199 285" stroke="#F8B984" strokeWidth="3" strokeLinecap="round" />
        <path className="art-loop art-loop-two" d="M438 241C462 217 493 231 485 254C480 272 456 267 463 250" stroke="#C8D6FC" strokeWidth="3" strokeLinecap="round" />
        <circle className="art-dot" cx="265" cy="58" r="5" fill="#F8B984" />
        <circle className="art-dot art-dot-two" cx="52" cy="75" r="4" fill="#C8D6FC" />
      </svg>
    </div>
  );
}

/**
 * Loopy — the peach blob from the journey art, on its own.
 * mood: 'wave' | 'happy' | 'think' | 'cheer' | 'sleep' | 'carry'
 */
export function Loopy({ mood = 'happy', size = 72, className, tone = '#F8B984' }) {
  const closed = mood === 'sleep';
  const big = mood === 'cheer';
  return (
    <svg aria-hidden="true" viewBox="60 70 110 125" width={size} height={size} className={cn('art-blob shrink-0 overflow-visible', className)}>
      <path d="M89 99C111 81 147 88 155 116C166 146 145 181 116 178C87 176 69 149 75 125C78 114 82 104 89 99Z" fill={tone} />
      {closed ? (
        <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none">
          <path d="M96 119q5 3 10 0" />
          <path d="M127 116q5 3 10 0" />
        </g>
      ) : (
        <>
          <circle cx="101" cy="118" r={big ? 3.6 : 3} fill={INK} />
          <circle cx="132" cy="115" r={big ? 3.6 : 3} fill={INK} />
        </>
      )}
      {mood === 'think' ? (
        <path d="M104 136C112 133 122 134 130 131" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      ) : big ? (
        <path d="M95 131C106 146 128 144 137 127Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      ) : (
        <path d="M95 133C106 138 125 138 136 127" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      )}
      {mood === 'wave' && <path d="M154 118C164 110 166 100 162 92" stroke={INK} strokeWidth="4" strokeLinecap="round" />}
      {mood === 'cheer' && (
        <g stroke="#F5D984" strokeWidth="4" strokeLinecap="round">
          <path d="M72 84v12M66 90h12" />
          <path d="M160 80v10M155 85h10" />
        </g>
      )}
      {mood === 'carry' && (
        <g>
          <path d="M146 138h22l-3 26h-16z" fill="#E9C99A" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M152 138c0-7 10-7 10 0" stroke={INK} strokeWidth="3" />
        </g>
      )}
      {mood === 'sleep' && <path d="M150 88h8l-8 9h8" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
    </svg>
  );
}

/** Drawn amber underline under a word. */
export function Squiggle({ children, className }) {
  return <span className={cn('underline-draw', className)}>{children}</span>;
}
