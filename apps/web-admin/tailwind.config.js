/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pakgreen: {
          50: '#e6f4ea',
          600: '#138808', // Pakistan Flag Green accent
          700: '#0f6e06',
        },
      },
    },
  },
  plugins: [],
}
