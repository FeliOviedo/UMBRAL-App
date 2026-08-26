---
name: Premium Kinetic Minimalism
colors:
  surface: '#111319'
  surface-dim: '#111319'
  surface-bright: '#36393f'
  surface-container-lowest: '#0b0e13'
  surface-container-low: '#191c21'
  surface-container: '#1d2025'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353b'
  on-surface: '#e1e2ea'
  on-surface-variant: '#c4c9af'
  inverse-surface: '#e1e2ea'
  inverse-on-surface: '#2e3036'
  outline: '#8e937c'
  outline-variant: '#444935'
  surface-tint: '#a7d626'
  primary: '#ffffff'
  on-primary: '#273500'
  primary-container: '#c2f344'
  on-primary-container: '#526d00'
  inverse-primary: '#4d6700'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#3b2c38'
  tertiary-container: '#f3dced'
  on-tertiary-container: '#715f6d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c2f344'
  primary-fixed-dim: '#a7d626'
  on-primary-fixed: '#151f00'
  on-primary-fixed-variant: '#394d00'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#f3dced'
  tertiary-fixed-dim: '#d6c0d0'
  on-tertiary-fixed: '#241723'
  on-tertiary-fixed-variant: '#52424f'
  background: '#111319'
  on-background: '#e1e2ea'
  surface-variant: '#32353b'
  zone-1: '#4ECDC4'
  zone-2: '#86E3CE'
  zone-3: '#D1FFAD'
  zone-4: '#FFD166'
  zone-5: '#FF8C42'
  zone-6: '#FF595E'
  zone-7: '#C06C84'
  ui-subtle: '#2C3139'
  text-muted: '#8E937C'
typography:
  display-hero:
    fontFamily: Archivo Black
    fontSize: 80px
    fontWeight: '900'
    lineHeight: 80px
    letterSpacing: -0.04em
  display-hero-mobile:
    fontFamily: Archivo Black
    fontSize: 56px
    fontWeight: '900'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Archivo Black
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  data-tabular-lg:
    fontFamily: IBM Plex Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  data-tabular-sm:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
spacing:
  unit: 4px
  margin-edge: 24px
  gutter: 16px
  section-gap: 64px
  component-gap: 12px
---

## Brand & Style

The design system is defined by a **Minimalist / High-Contrast** aesthetic that leans heavily into the "Premium Athletic" sector. It moves away from traditional digital interface conventions like heavy cards and borders, instead adopting a "Less is More" philosophy that mirrors elite sports instrumentation.

The brand personality is clinical, focused, and aggressive. It targets the "performance-obsessed" athlete who requires immediate data clarity without visual noise. The emotional response is one of high-velocity precision—removing everything that doesn't contribute to the athlete's immediate focus. Hierarchy is the primary tool for navigation, utilizing extreme scale differences between hero metrics and supporting metadata.

## Colors

The palette is anchored by a deep, monochromatic "void" background to eliminate peripheral distraction. 

- **Primary (Electric Lime):** Reserved for high-voltage moments—active metrics, primary action triggers, and progress indicators. 
- **Secondary (Pure White):** Used for maximum legibility of primary data and hero typography.
- **Neutral (Deep Obsidian):** The foundational background color (#0B0E13). 
- **Thermal Scale:** A 7-zone system used exclusively for physiological data. These colors should never be used for UI decoration; they are semantic indicators of intensity.
- **Subtle Accents:** Use low-contrast greys for labels and non-essential dividers to maintain the "instrument" feel.

## Typography

The typographic strategy utilizes extreme contrast to establish a clear 2-level hierarchy.

1. **Archivo Black (Impact):** Used for "Giant Hero Data." This font is a sports instrument; it should feel massive and immovable.
2. **Inter (UI/Body):** Used for all functional interface text and descriptions. It is neutral and vanishes to let the data speak.
3. **IBM Plex Mono (Precision):** Reserved for secondary metrics, split times, and tabular data where character alignment is critical for rapid scanning.

**Hierarchy Rule:** Every primary data point must be accompanied by a `label-caps` descriptor. The size ratio between the data and the label should be at least 4:1.

## Layout & Spacing

This design system uses a **Fluid Grid** with a "Negative Space First" philosophy. Instead of using boxes to contain content, use generous vertical rhythm.

- **Negative Space:** Use `section-gap` (64px) to separate distinct data clusters. Physical lines or background changes should be avoided.
- **Margins:** High-performance layouts require "breathing room." Maintain a strict 24px margin on all edges to ensure content is never crowded by the device frame.
- **Alignment:** Content should be primarily left-aligned or centered depending on the density of the metric. In "In-Run" views, center-alignment for single massive metrics is preferred.

## Elevation & Depth

In alignment with the minimalist aesthetic, this system avoids traditional shadows and layered surfaces. 

- **Flat Architecture:** All elements exist on the same 2D plane. 
- **Separation via Contrast:** Use the primary background (#0B0E13) for everything. If a container is strictly necessary (e.g., a sticky bottom sheet), use a subtle tonal shift to #151A22 without a border.
- **Focus States:** Instead of elevation, use "Active Illumination." An active state is indicated by the primary lime green color, either through text color changes or a 2px solid underline.

## Shapes

The shape language is **Sharp and Geometric**. 

- **Elements:** Buttons, input fields, and UI blocks use 0px radius corners to maintain a technical, engineered appearance.
- **Interactive Pill:** The only exception is the Pill/Chip component, which uses a 100px "full pill" radius to signify its status as a distinct, tappable object.

## Components

- **Buttons:** Large, rectangular, and sharp-edged. The Primary button is solid #CDFF4F with #0B0E13 text. No border. Secondary buttons are text-only with a heavy underline.
- **Pills/Chips:** Simplified to a single-color accent. Use a solid #FFFFFF pill with black text for filters, or a Zone-colored pill for intensity markers. Remove all background glows or gradients.
- **Labels:** Use `label-caps`. They should be colored in `text-muted` (#8E937C) to push them into the background relative to the data.
- **Input Fields:** A single 1px line at the bottom of the field. No box. When focused, the line turns #CDFF4F.
- **Data Visualization:** Line charts use a 2px solid stroke with no fill. Intersections or peaks are marked with a simple 4px square dot. 
- **Lists:** Separated by whitespace or a very subtle 1px line in `#2C3139`. No background containers.
- **Hero Metrics:** The core of the design. A massive Archivo Black number followed by a small, discreet `label-caps` descriptor.