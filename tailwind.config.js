/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Same pairing as BenefitBridge: a friendly sans for reading, a classic serif for headlines.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))', soft: 'hsl(var(--primary-soft))' },
        teal: 'hsl(var(--teal))',
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))', soft: 'hsl(var(--accent-soft))' },
        amber: { DEFAULT: 'hsl(var(--amber))', edge: 'hsl(var(--amber-edge))' },
        tile: { 1: 'hsl(var(--tile-1))', 2: 'hsl(var(--tile-2))', 3: 'hsl(var(--tile-3))', 4: 'hsl(var(--tile-4))', 5: 'hsl(var(--tile-5))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        danger: { DEFAULT: 'hsl(var(--danger))', foreground: 'hsl(var(--danger-foreground))', soft: 'hsl(var(--danger-soft))' },
        success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
        ink: 'hsl(var(--ink))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      boxShadow: {
        // BenefitBridge's soft lift and its flat pastel offsets.
        soft: '0 24px 52px -28px rgba(34, 78, 57, 0.35)',
        lift: '0 24px 52px -20px rgba(34, 78, 57, 0.3)',
        offset: '6px 7px 0 hsl(var(--offset))',
        'offset-lg': '9px 10px 0 hsl(var(--butter-edge))',
        amber: '4px 5px 0 hsl(var(--amber-edge))',
        mint: '4px 5px 0 hsl(var(--mint-edge))',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(0.6)' }, '60%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '-400px 0' }, to: { backgroundPosition: '400px 0' } },
        'phrase-arrive': { from: { opacity: 0, transform: 'translateY(30px) rotate(2deg)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        pop: 'pop 0.3s ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
        'phrase-arrive': 'phrase-arrive 0.95s cubic-bezier(.19,1,.22,1) both',
      },
    },
  },
  plugins: [],
};
