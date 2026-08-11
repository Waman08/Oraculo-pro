import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Psicología contraintuitiva para el trading
        // Verde = Peligro / Sobrecompra
        'danger-green': '#10B981', 
        // Rojo = Oportunidad / Compra
        'buy-red': '#EF4444',
        
        // Colores de fondo oscuros institucionales
        'dark-bg': '#0B0E14',
        'dark-panel': '#151924',
        'dark-border': '#2B3139',
        
        // Acentos
        'accent-yellow': '#F5B041',
      },
    },
  },
  plugins: [],
};
export default config;
