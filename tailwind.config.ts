import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--cf-bg)",
        ink: "var(--cf-text)",
        terracotta: "var(--cf-accent-terracotta)",
        sage: "var(--cf-accent-sage)",
        indigo: "var(--cf-accent-indigo)",
        panel: "var(--cf-panel)"
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "STSong", "serif"],
        sans: ["PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "sans-serif"]
      },
      boxShadow: {
        soft: "0 8px 24px rgba(30, 25, 20, 0.08)"
      },
      transitionTimingFunction: {
        paper: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },
  plugins: []
} satisfies Config;
