/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#6366f1",
        "primary-dark": "#4f46e5",
        secondary: "#10b981",
        surface: "#f8fafc",
        "surface-base": "#ffffff",
        "surface-100": "#f1f5f9",
        "surface-200": "#e2e8f0",
        "surface-300": "#cbd5e1",
        "on-surface": "#0f172a",
        "on-surface-variant": "#64748b",
        "on-primary": "#ffffff",
        error: "#ef4444",
        outline: "#e2e8f0",
        "outline-variant": "#cbd5e1",
        accent: "#6366f1",
        "accent-2": "#4f46e5",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        headline: ["Outfit", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
