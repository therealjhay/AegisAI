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
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring))",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        primary: {
          DEFAULT: "oklch(var(--primary))",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary))",
          foreground: "oklch(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted))",
          foreground: "oklch(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "oklch(var(--accent))",
          foreground: "oklch(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        // Brand palette extracted from the AegisAI logo
        navy: {
          DEFAULT: "#0C2448",
          deep: "#0A1B36",
          ink: "#0C183C",
          soft: "#3D4E6E",
        },
        signal: {
          DEFAULT: "#F06820",
          bright: "#F97A2E",
          deep: "#D5570F",
          wash: "#FDEADF",
        },
        paper: {
          DEFAULT: "#F7F6F1",
          raised: "#FCFBF8",
          dim: "#EFEDE5",
        },
        line: {
          DEFAULT: "#DFDCD2",
          strong: "#C9C5B8",
        },
      },
      maxWidth: {
        shell: "72rem",
      },
    },
  },
  plugins: [],
};
export default config;
