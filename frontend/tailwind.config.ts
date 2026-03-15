import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: "#0f0f0f", 1: "#161616", 2: "#1e1e1e", 3: "#272727" },
        muted: "#6b6b6b",
      },
    },
  },
};
export default config;
