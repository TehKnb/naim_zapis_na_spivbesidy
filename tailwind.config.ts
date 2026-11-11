import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#006BFF', hover: '#0057D1', 50: '#EBF3FF', 100: '#D6E6FF' },
        // Темно-синій для головних кнопок (як «Create» у Calendly)
        navy: { DEFAULT: '#0B3558', hover: '#0A2A46' },
        ink: { DEFAULT: '#0F1E33', muted: '#56657A', soft: '#94A0B2' },
        canvas: '#F2F4F8',
        surface: '#FFFFFF',
        line: { DEFAULT: '#E3E7EE', strong: '#C4CCD8' },
        success: { DEFAULT: '#12B76A', 50: '#E8FAF0', 700: '#05794A' },
        warning: { DEFAULT: '#F79009', 50: '#FFF6E5', 700: '#B54708' },
        danger: { DEFAULT: '#D92D20', 50: '#FEF3F2', 700: '#B42318' },
        violet: { DEFAULT: '#8247F5', 50: '#F3EDFF', 700: '#5B21D6' },
        neutral: { 50: '#F8FAFC', 100: '#F1F4F8', 200: '#E3E7EE', 500: '#56657A', 700: '#344054' },
      },
      backgroundImage: {
        // Градієнт-акцент (як смуга картки Callie)
        brand: 'linear-gradient(180deg, #E55CFF 0%, #8247F5 50%, #0099FF 100%)',
        'brand-x': 'linear-gradient(90deg, #E55CFF 0%, #8247F5 50%, #0099FF 100%)',
        'brand-soft': 'linear-gradient(135deg, #FCE7FF 0%, #EDE4FF 45%, #DDEEFF 100%)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '12px' },
      boxShadow: {
        xs: '0 1px 2px rgba(15, 30, 51, 0.05)',
        card: '0 1px 3px rgba(15, 30, 51, 0.06), 0 1px 2px rgba(15, 30, 51, 0.04)',
        lift: '0 10px 24px -10px rgba(15, 30, 51, 0.22), 0 2px 6px -2px rgba(15, 30, 51, 0.08)',
        pop: '0 12px 32px -8px rgba(15, 30, 51, 0.2), 0 4px 8px -4px rgba(15, 30, 51, 0.06)',
      },
      screens: { xs: '420px' },
    },
  },
  plugins: [],
};

export default config;
