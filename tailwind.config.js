/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semânticos existentes — agora resolvidos via CSS var (ver index.css)
        // para se adaptar automaticamente entre tema claro/escuro, inclusive
        // nas telas que ainda não foram migradas para o novo design system.
        // Formato rgb(var(...) / <alpha-value>) — não "var(--x)" direto —
        // porque só assim os modificadores de opacidade (bg-receita/10 etc.)
        // continuam funcionando com uma cor vinda de variável CSS.
        receita: "rgb(var(--receita-rgb) / <alpha-value>)",
        despesa: "rgb(var(--despesa-rgb) / <alpha-value>)",
        info: "rgb(var(--info-rgb) / <alpha-value>)",
        alerta: "rgb(var(--alerta-rgb) / <alpha-value>)",
        // Tokens do design system futurista (fase Dashboard em diante).
        void: "var(--void)",
        surface: "var(--card)",
        surface2: "var(--card2)",
        line: "var(--line)",
        muted: "var(--muted)",
        bright: "var(--bright)",
        neon: "var(--neon)",
        expense: "var(--expense)",
        alert: "var(--alert)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
