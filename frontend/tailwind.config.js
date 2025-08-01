/**   @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
               dark: {
          bg: '#000000',
          card: '#000000',
          border: '#333333',
          text: '#ffffff',
          textSecondary: '#10b981',
          input: '#121212'
        } 
      },
    },
  },
  plugins: [],
}; 
 