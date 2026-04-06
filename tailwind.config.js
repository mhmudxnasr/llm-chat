/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#212121',
        ink: '#171717',
        panel: '#2f2f2f',
        accent: '#10a37f',
        accentSoft: '#12372f',
        chatline: '#303030',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        heading: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-slide': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.92)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-slide': 'fade-slide 0.45s ease-out',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
        float: 'float 8s ease-in-out infinite',
      },
      boxShadow: {
        panel:
          '0 24px 80px rgba(3, 7, 18, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      backgroundImage: {
        mesh: 'radial-gradient(circle at top left, rgba(94, 234, 212, 0.18), transparent 32%), radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.16), transparent 30%)',
      },
    },
  },
  plugins: [],
}
