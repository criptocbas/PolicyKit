import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090d",
          900: "#0c1017",
          800: "#121826",
          700: "#1a2233",
          600: "#243047",
        },
        mint: {
          300: "#7dffe0",
          400: "#3dffc8",
          500: "#14e0a8",
          600: "#0bb88a",
        },
        coral: {
          400: "#ff7a6e",
          500: "#ff5347",
          600: "#e03428",
        },
        amber: {
          400: "#ffc857",
          500: "#f5a623",
        },
        mist: {
          100: "#e8edf5",
          300: "#9aa8bd",
          400: "#6b7c94",
          500: "#4a5a70",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(20, 224, 168, 0.35)",
        "glow-coral": "0 0 32px -8px rgba(255, 83, 71, 0.4)",
        panel:
          "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -16px rgba(0,0,0,0.55)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        "radial-mint":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(20,224,168,0.12), transparent)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
