/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#0a0e27',
          800: '#111c44',
          700: '#1b254b',
          600: '#2b3674',
          500: '#4318ff',
          400: '#6b5ce7',
          300: '#a3aed0',
          200: '#e0e5f2',
          100: '#f4f7fe',
        }
      }
    },
  },
  plugins: [],
}