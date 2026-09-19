/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Slate/graphite base — a jobsite tool, not a marketing page.
        ink: {
          950: '#14181C',
          900: '#1F2A37',
          800: '#2B3947',
          600: '#4B5C6B',
          400: '#8598A6',
          200: '#D5DEE3',
          100: '#EAEFF1',
          50: '#F5F6F7'
        },
        // Safety-amber accent — a nod to hi-vis site gear without being loud.
        signal: {
          600: '#B4720C',
          500: '#D98E1F',
          400: '#F0A93A',
          100: '#FBEAD2'
        },
        // Status colors used consistently for progress tags.
        status: {
          todo: '#8598A6',
          progress: '#D98E1F',
          done: '#3E8E5D',
          blocked: '#C0503E'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      maxWidth: {
        app: '32rem'
      }
    }
  },
  plugins: []
}
