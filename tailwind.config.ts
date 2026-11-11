import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#006BFF', hover: '#0057D1', 50: '#EBF3FF', 100: '#D6E6FF' },
        ink: { DEFAULT: '#101828', muted: '#667085', soft: '#98A2B3' },
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        line: { DEFAULT: '#EAECF0', strong: '#D0D5DD' },
        success: { DEFAULT: '#12B76A', 50: '#ECFDF3', 700: '#027A48' },
        warning: { DEFAULT: '#F79009', 50: '#FFFAEB', 700: '#B54708' },
        danger: { DEFAULT: '#D92D20', 50: '#FEF3F2', 700: '#B42318' },
        neutral: { 50: '#F9FAFB', 100: '#F2F4F7', 200: '#EAECF0', 500: '#667085', 700: '#344054' },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '12px' },
      boxShadow: {
        xs: '0 1px 2px rgba(16, 24, 40, 0.04)',
        pop: '0 12px 32px -8px rgba(16, 24, 40, 0.18), 0 4px 8px -4px rgba(16, 24, 40, 0.06)',
      },
      screens: { xs: '420px' },
    },
  },
  plugins: [],
};

export default config;
