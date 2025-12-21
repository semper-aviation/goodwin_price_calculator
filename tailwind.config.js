/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    // ...existing code...
  ],
  theme: {
    extend: {
      colors: {
        // Use slate as the default background and text color palette
        background: {
          DEFAULT: "#f8fafc", // slate-50
        },
        foreground: {
          DEFAULT: "#0f172a", // slate-900
        },
      },
      borderRadius: {
        xl: "1rem",
      },
      boxShadow: {
        DEFAULT: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)",
        xl: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
      },
    },
  },
  darkMode: "class", // or 'media'
  plugins: [],
}
