/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FBFAF7',
        cream: '#F5F0E6',
        ink: '#1C1917',
        muted: '#78716C',
        faint: '#A8A29E',
        line: '#E7E0D4',
        ember: {
          DEFAULT: '#EA580C',
          soft: '#FFF1E8',
          deep: '#C2410C',
        },
        moss: {
          DEFAULT: '#15803D',
          soft: '#E8F7EE',
        },
        gold: {
          DEFAULT: '#D97706',
          soft: '#FFF7E6',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 25, 23, 0.05), 0 4px 16px rgba(28, 25, 23, 0.06)',
        lift: '0 2px 4px rgba(28, 25, 23, 0.06), 0 12px 32px rgba(28, 25, 23, 0.10)',
      },
    },
  },
  plugins: [],
};
