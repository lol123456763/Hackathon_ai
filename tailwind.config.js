/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
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
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))', soft: 'hsl(var(--accent-soft))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        danger: { DEFAULT: 'hsl(var(--danger))', foreground: 'hsl(var(--danger-foreground))', soft: 'hsl(var(--danger-soft))' },
        success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px rgb(15 23 42 / 0.06)',
        lift: '0 2px 4px rgb(15 23 42 / 0.06), 0 12px 32px rgb(15 23 42 / 0.10)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(0.6)' }, '60%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '-400px 0' }, to: { backgroundPosition: '400px 0' } },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        pop: 'pop 0.3s ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
