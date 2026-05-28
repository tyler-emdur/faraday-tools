import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#04080f",
          900: "#070d1a",
          800: "#0c1525",
          700: "#112030",
          600: "#162b3d",
        },
        electric: {
          DEFAULT: "#0ea5e9",
          bright: "#38bdf8",
          dim: "#0369a1",
          glow: "rgba(14,165,233,0.15)",
        },
        slate: {
          925: "#0d1424",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(14,165,233,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.04) 1px, transparent 1px)",
        "hero-gradient":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(14,165,233,0.18) 0%, transparent 60%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(14,165,233,0.06) 0%, transparent 60%)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
      boxShadow: {
        electric: "0 0 24px rgba(14,165,233,0.25)",
        "electric-sm": "0 0 12px rgba(14,165,233,0.15)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
