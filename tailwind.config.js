/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wave: {
          ink: "#21312d",
          deep: "#256b5b",
          mint: "#e8f5f1",
          blush: "#f8d9cf",
          cream: "#fffaf6"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 24px 80px rgba(33,49,45,0.12)"
      }
    }
  },
  plugins: []
};
