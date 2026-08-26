import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Design system de Umbral.
 *
 * Los valores NO son una interpretación del brief: salen medidos de los HTML de
 * Stitch en `design-reference/`. Cuando haga falta tocar algo acá, la fuente de
 * verdad son esos archivos —en particular `dashboard_minimalista`,
 * `esta_semana_minimalista` y `registro_actividad_minimalista_claro`—, no el
 * criterio de quien esté editando.
 *
 * Los tokens de color viven como variables CSS en src/index.css.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          high: 'hsl(var(--surface-high))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--border))',
        ring: 'hsl(var(--accent))',
        fg: {
          DEFAULT: 'hsl(var(--fg))',
          muted: 'hsl(var(--fg-muted))',
        },
        // Gris verdoso de Stitch. Es el color de las labels y del texto de
        // menor jerarquía; se distingue de fg-muted, que es más frío.
        outline: 'hsl(var(--outline))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          // Lima apagado, para barras y estados secundarios.
          dim: 'hsl(var(--accent-dim))',
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
        // Títulos de sección y nombres de sesión. En Stitch es Archivo Black,
        // no Space Grotesk: los títulos comparten familia con los números.
        title: ['"Archivo Black"', 'system-ui', 'sans-serif'],
        // Sólo el wordmark "UMBRAL".
        wordmark: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        // Cuerpo y textos de apoyo.
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Labels y tablas numéricas. Stitch usa JetBrains Mono en las dos
        // pantallas oscuras, que son las que definen el tema por defecto.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Escala hero, medida de Stitch. `hero` es el tamaño de móvil.
        'hero-sm': ['40px', { lineHeight: '40px', letterSpacing: '-0.03em' }],
        hero: ['56px', { lineHeight: '56px', letterSpacing: '-0.04em' }],
        'hero-lg': ['96px', { lineHeight: '96px', letterSpacing: '-0.04em' }],
        // Títulos: Archivo Black 28px.
        title: ['28px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        'title-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        // Wordmark.
        wordmark: ['24px', { lineHeight: '32px', letterSpacing: '-0.04em', fontWeight: '700' }],
        // Label en mayúscula, mono.
        label: ['11px', { lineHeight: '16px', letterSpacing: '0.1em', fontWeight: '600' }],
        // Datos numéricos, mono.
        data: ['18px', { lineHeight: '24px', fontWeight: '500' }],
        'data-sm': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        // Cuerpo.
        body: ['14px', { lineHeight: '20px' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
      },
      borderRadius: {
        // Stitch es mucho más cuadrado de lo que decía el brief: el radio
        // grande es 8px, no 16px, y buena parte de los controles no lleva
        // radio en absoluto.
        DEFAULT: '4px',
        sm: '4px',
        md: '8px',
        lg: '8px',
        xl: '12px',
      },
      spacing: {
        // Escala de Stitch, en px tal cual la declara.
        unit: '4px',
        component: '12px',
        gutter: '16px',
        // Margen lateral del contenido en móvil.
        edge: '20px',
        // Separación entre secciones.
        section: '32px',
        // Separación entre bloques grandes del dashboard.
        block: '48px',
      },
      boxShadow: {
        // El acento lima siempre viene con halo en Stitch. Es la única
        // "decoración" del sistema y es lo que le da el aire de app premium.
        glow: '0 0 8px rgba(205, 255, 79, 0.5)',
        'glow-soft': '0 0 8px rgba(205, 255, 79, 0.4)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
