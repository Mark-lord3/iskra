/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Utility classes read the same custom properties as styles.css, so the
           two systems cannot drift apart. */
        blush: "var(--bg)",
        surface: "var(--surface)",
        softpink: "var(--soft-pink)",
        peach: "var(--peach)",
        champagne: "var(--champagne)",
        pink: { DEFAULT: "var(--pink)", ink: "var(--pink-ink)", fill: "var(--pink-fill)" },
        coral: { DEFAULT: "var(--coral)", ink: "var(--coral-ink)", fill: "var(--coral-fill)" },
        berry: "var(--berry)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        hairline: "var(--line)",
        success: { DEFAULT: "var(--success)", ink: "var(--success-ink)" },
        warning: { DEFAULT: "var(--warning)", ink: "var(--warning-ink)" },
        /* Kept so existing markup keeps compiling while it is migrated. */
        ember: { 50: "#fff7ed", 200: "#fed7aa", 400: "#fb923c", 500: "var(--pink-fill)", 700: "#c2410c" },
        night: { 950: "var(--bg)" }
      },
      boxShadow: {
        pulse: "var(--shadow-card)",
        lift: "var(--shadow-lift)"
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

