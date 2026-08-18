import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        health: {
          bg: "rgb(var(--c-bg) / <alpha-value>)",
          card: "rgb(var(--c-card) / <alpha-value>)",
          ink: "rgb(var(--c-ink) / <alpha-value>)",
          muted: "rgb(var(--c-muted) / <alpha-value>)",
          line: "rgb(var(--c-line) / <alpha-value>)",
          fill: "rgb(var(--c-fill) / <alpha-value>)",
          "on-fill": "rgb(var(--c-on-fill) / <alpha-value>)",
        },
        coral: {
          DEFAULT: "rgb(var(--c-coral) / <alpha-value>)",
          soft: "rgb(var(--c-coral-soft) / <alpha-value>)",
          dark: "rgb(var(--c-coral-dark) / <alpha-value>)",
        },
        violet: {
          DEFAULT: "rgb(var(--c-violet) / <alpha-value>)",
          soft: "rgb(var(--c-violet-soft) / <alpha-value>)",
          dark: "rgb(var(--c-violet-dark) / <alpha-value>)",
        },
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
