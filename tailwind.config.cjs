/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme")
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue,mjs}"],
  darkMode: "class", // allows toggling dark mode manually
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter Variable",
          "PingFang SC",
          "Microsoft YaHei",
          ...defaultTheme.fontFamily.sans,
        ],
        serif: [
          "Playfair Display Variable",
          "Noto Serif SC Variable",
          "Source Han Serif SC",
          "Songti SC",
          ...defaultTheme.fontFamily.serif,
        ],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
