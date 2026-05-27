import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        /** Twitch / STREAMFY legacy (frontend/index.html) — tema scuro principale. */
        lux: {
          dark: "#0e0e10",
          panel: "#18181b",
          card: "#1f1f23",
          /** Bordo pannelli (nome `edge`: evita clash con utility `border`). */
          edge: "#2c2c33",
          violet: "#a970ff",
          "violet-hover": "#8c4fe6",
          "violet-muted": "#a970ff66",
          text: "#efeff1",
          muted: "#adadb8",
        },
        /** Palette calda: beige + accent rosa antico (mantiene i nomi `cam-*`). */
        cam: {
          bg: "#efe6dc",
          ink: "#2a2426",
          shell: "#e3d9d0",
          inset: "#f4ece5",
          sidebar: "#e8dfd6",
          card: "#faf6f0",
          border: "#d2c6bd",
          bar: "#5a4a50",
          "bar-text": "#fdf8f6",
          ctaInk: "#2a2426",
          orange: "#c0607c",
          "orange-bright": "#e07d98",
          "orange-dim": "#9e4d66",
          "orange-glow": "rgba(192, 96, 124, 0.28)",
          text: "#3a3436",
          muted: "#7a6e72",
        },
        // Brand rosato (tips/CTA secondari compatibili con vecchie classi cb-*)
        cb: {
          black: "#000000",
          ink: "#1a1a1a",
          surface: "#ffffff",
          mute: "#f5f5f5",
          line: "#e5e7eb",
          text: "#1f2937",
          subtext: "#6b7280",
          pink: "#ff5fa2",
          "pink-deep": "#db2777",
          "pink-soft": "#ffe4f0",
          accent: "#ff8ad0",
        },
        // Legacy (per non rompere file vecchi)
        void: "#0f0f0f",
        ink: "#111827",
        violet: {
          glow: "#db2777",
          core: "#be185d",
        },
      },
      boxShadow: {
        neon: "0 0 24px rgba(219, 39, 119, 0.35)",
        card: "0 4px 16px rgba(0, 0, 0, 0.08)",
        cardHover: "0 8px 24px rgba(0, 0, 0, 0.12)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(255,255,255,0.6), #ffffff)",
        "pink-cta": "linear-gradient(135deg, #ff5fa2 0%, #db2777 100%)",
        /** Accento tipico dell’homepage legacy (violetto Twitch-style). */
        "lux-cta": "linear-gradient(135deg, #b47fff 0%, #8c4fe6 100%)",
        /** CTA rosa sulla directory. */
        "cam-cta":
          "linear-gradient(180deg, #f4a9bc 0%, #c8607f 52%, #a84d69 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
