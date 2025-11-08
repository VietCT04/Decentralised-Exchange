// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",                           // <- force via .dark class
  content: [
    "./src/app/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/components/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/lib/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: { extend: {} },
  plugins: [], // if you use shadcn/ui, add: require("tailwindcss-animate")
} satisfies Config;
