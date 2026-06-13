import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        grid: {
          base: "#0a0f1e",
          panel: "rgba(9, 18, 34, 0.72)",
          cyan: "#22d3ee",
          green: "#22c55e",
          amber: "#eab308",
          orange: "#f97316",
          red: "#ef4444"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      animation: {
        "slow-pulse": "pulse 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scan: "scan 7s linear infinite"
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
