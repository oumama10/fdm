/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#0B3D4A',
          700: '#0F6E56',
          500: '#1D9E75',
          100: '#E1F5EE',
        },
        gold: {
          600: '#9A6E1A',
          100: '#FDF3DC',
        },
        surface: '#F7F5F0',
        ink: '#1A1A2E',
      },
      fontFamily: {
        heading: ['Bricolage Grotesque', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
