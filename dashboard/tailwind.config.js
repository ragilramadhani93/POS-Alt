/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E8460A',
          hover: '#C43808',
          fg: '#FFFFFF',
        },
        surface: '#FFFFFF',
        bg: '#F7F5F2',
        border: '#E2DDD8',
        text: {
          DEFAULT: '#1A1714',
          muted: '#6B6460',
        },
      },
    },
  },
  plugins: [],
}
