/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  // Wrap every hover: in @media (hover: hover) so touch taps don't trigger hover motion
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // System font first: it ships optical sizing and tracking tables (SF Pro on Apple platforms)
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        mono: ['ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Tracking is size-specific: slightly open at small sizes, tighter as text grows
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }],
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.005em' }],
        callout: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '-0.003em' }],
        sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '-0.006em' }],
        base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.011em' }],
        lg: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.014em' }],
        xl: ['1.25rem', { lineHeight: '1.625rem', letterSpacing: '-0.017em' }],
        '2xl': ['1.5rem', { lineHeight: '1.875rem', letterSpacing: '-0.019em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.021em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.022em' }],
      },
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Semantic tokens (defined per theme in index.css)
        app: token('bg'),
        surface: {
          DEFAULT: token('surface'),
          2: token('surface-2'),
          raised: token('surface-raised'),
        },
        label: {
          DEFAULT: token('label'),
          2: token('label-2'),
          3: token('label-3'),
        },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          text: token('accent-text'),
        },
        danger: { DEFAULT: token('danger'), text: token('danger-text') },
        success: token('success'),
        warning: token('warning'),
        separator: 'var(--separator)',
        fill: {
          DEFAULT: 'var(--fill)',
          2: 'var(--fill-2)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--separator)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        popover: 'var(--shadow-popover)',
        sheet: 'var(--shadow-sheet)',
        hairline: '0 0 0 0.5px var(--separator)',
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      // Stronger curves than the CSS built-ins; these override Tailwind's ease-out/ease-in-out
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms cubic-bezier(0.23, 1, 0.32, 1)',
        'pop-in': 'pop-in 180ms cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
  plugins: [],
}
