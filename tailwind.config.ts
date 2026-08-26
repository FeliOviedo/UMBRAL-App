import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Design system de Umbral.
 * Los tokens de color viven como variables CSS en src/index.css (tema oscuro por
 * defecto) y se exponen acá para que Tailwind y shadcn/ui los consuman.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--border))',
        ring: 'hsl(var(--accent))',
        fg: {
          DEFAULT: 'hsl(var(--fg))',
          muted: 'hsl(var(--fg-muted))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // Colores de zona Friel. Se usan como zone-z1 … zone-z5c.
        zone: {
          z1: '#5B6B7A',
          z2: '#2FB6C4',
          z3: '#54C48A',
          z4: '#F2B43D',
          z5a: '#F58A3C',
          z5b: '#EF5F3C',
          z5c: '#E23B4E',
        },
      },
      fontFamily: {
        // Números protagonistas (distancia, pace, cronómetro).
        hero: ['"Archivo Black"', 'system-ui', 'sans-serif'],
        // Títulos de sección.
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        // Cuerpo y etiquetas.
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Tablas numéricas (splits, zonas).
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Escala hero: pocos datos, muy grandes.
        'hero-sm': ['2.5rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        hero: ['3.5rem', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'hero-lg': ['4.5rem', { lineHeight: '0.9', letterSpacing: '-0.03em' }],
        // Label discreta en mayúscula.
        label: ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.12em' }],
      },
      borderRadius: {
        lg: '16px',
        md: '12px',
        sm: '8px',
      },
      spacing: {
        // Respiración generosa entre secciones (estilo sobrio, sin cajas).
        section: '2.5rem',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
