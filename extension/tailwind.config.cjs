/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./entrypoints/**/*.{ts,tsx,html}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      maxWidth: {
        panel: "400px",
      },
    },
  },
  plugins: [],
};
