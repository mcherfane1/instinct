/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hbird: {
          50:  '#f0f7ff',
          100: '#e0efff',
          200: '#b9d9ff',
          300: '#7bb8ff',
          400: '#3491f8',
          500: '#0a6fd8',
          600: '#0069b4',   // Primary brand blue
          700: '#0058a0',
          800: '#014880',
          900: '#003560',
          950: '#001d38',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
      fontFamily: {
        sans: [
          'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
