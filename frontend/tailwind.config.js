export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-900': '#0B3D4A',
        'brand-700': '#0F6E56',
        'brand-500': '#1D9E75',
        'brand-100': '#E1F5EE',
        'gold-600': '#9A6E1A',
        'gold-100': '#FDF3DC',
        'surface': '#F0F2F5',
        'ink': '#1A1A2E',
      },
      fontFamily: {
        'bricolage': ['Bricolage Grotesque', 'sans-serif'],
        'dm-sans': ['DM Sans', 'sans-serif'],
        'jetbrains': ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '220': '220px',
      },
    },
  },
  plugins: [],
};
