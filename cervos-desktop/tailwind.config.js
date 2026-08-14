/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#6366f1",
        secondary: "#10b981",
        surface: "#f8fafc",
        "surface-base": "#ffffff",
        "on-surface": "#0f172a",
        "on-surface-variant": "#64748b",
        "on-primary": "#ffffff",
        error: "#ef4444",
        outline: "#e2e8f0",
        "outline-variant": "#cbd5e1",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        headline: ["Outfit", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
