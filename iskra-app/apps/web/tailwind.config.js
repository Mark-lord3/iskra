/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ember: {
          50: "#fff7ed",
          200: "#fed7aa",
          400: "#fb923c",
          500: "#f97316",
          700: "#c2410c"
        },
        night: {
          950: "#09090b"
        }
      },
      boxShadow: {
        pulse: "0 0 0 1px rgba(255,255,255,0.08), 0 24px 80px rgba(249,115,22,0.18)"
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

