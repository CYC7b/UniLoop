/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        uniloop: {
          50:  '#FBF8F6',
          100: '#F5E8DE',
          200: '#EAC8B0',
          300: '#DBA882',
          400: '#CC8860',
          500: '#D97757',
          600: '#C06642',
          700: '#9A4428',
          800: '#7A2E18',
          900: '#5A1E0C',
        }
      }
    }
  },
  plugins: [],
}
