import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Canonical Cervos Color Tokens ──────────────────────────────
      colors: {
        // Core brand
        primary: "#1039b9",
        "primary-container": "#3454d1",
        "on-primary": "#ffffff",
        "on-primary-container": "#d4d9ff",
        "primary-fixed": "#dde1ff",
        "primary-fixed-dim": "#b8c3ff",
        "on-primary-fixed": "#001355",
        "on-primary-fixed-variant": "#0c37b7",
        "inverse-primary": "#b8c3ff",

        secondary: "#006875",          // ← canonical (teal), not #5d5c74
        "on-secondary": "#ffffff",
        "secondary-container": "#00e3fd",
        "on-secondary-container": "#00616d",
        "secondary-fixed": "#9cf0ff",
        "secondary-fixed-dim": "#00daf3",
        "on-secondary-fixed": "#001f24",
        "on-secondary-fixed-variant": "#004f58",

        tertiary: "#00542c",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#006f3c",
        "on-tertiary-container": "#6ef5a0",
        "tertiary-fixed": "#75fca7",
        "tertiary-fixed-dim": "#57df8d",
        "on-tertiary-fixed": "#00210e",
        "on-tertiary-fixed-variant": "#00522b",

        // Surface system — canonical #fcf8ff
        surface: "#fcf8ff",
        "surface-base": "#ffffff",
        "surface-bright": "#fcf8ff",
        "surface-dim": "#dad7f3",
        "surface-variant": "#e2e0fc",
        "surface-muted": "#f8f9fc",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f5f2ff",
        "surface-container": "#efecff",
        "surface-container-high": "#e8e5ff",
        "surface-container-highest": "#e2e0fc",
        "surface-tint": "#3252cf",
        "inverse-surface": "#2f2e43",
        "inverse-on-surface": "#f2efff",
        background: "#fcf8ff",

        // Text / ink
        "on-surface": "#1a1a2e",
        "on-background": "#1a1a2e",
        "on-surface-variant": "#444654",
        "ink-deep": "#1A1A2E",
        "text-muted": "#6B7280",

        // Utility
        outline: "#747685",
        "outline-variant": "#c4c5d6",

        // Error
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        // Category
        "category-news-bg": "#E6E6FA",
      },

      // ── Fonts ────────────────────────────────────────────────────────
      fontFamily: {
        "headline-xl": ["Outfit", "sans-serif"],
        "headline-lg": ["Outfit", "sans-serif"],
        "headline-md": ["Outfit", "sans-serif"],
        "headline-lg-mobile": ["Outfit", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "label-md": ["Inter", "sans-serif"],
        // JetBrains Mono: version strings / code only
        mono: ["JetBrains Mono", "monospace"],
      },

      fontSize: {
        "headline-xl": ["40px", { lineHeight: "48px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-lg-mobile": ["28px", { lineHeight: "34px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
      },

      // ── Spacing ─────────────────────────────────────────────────────
      spacing: {
        // Marketing tokens
        margin: "32px",
        gutter: "24px",
        unit: "4px",
        "container-max": "1440px",
        // Portal tokens
        "margin-desktop": "48px",
        "margin-mobile": "16px",
        "stack-sm": "4px",
        "stack-md": "12px",
        "stack-lg": "24px",
        base: "8px",
      },

      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },

      maxWidth: {
        "container-max": "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
