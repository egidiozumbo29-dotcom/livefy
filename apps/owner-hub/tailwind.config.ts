import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        card: "#15181d",
        border: "#262a31",
        text: "#e7e9ee",
        muted: "#8a90a0",
        accent: "#f97316",
      },
    },
  },
  plugins: [],
};

export default config;
