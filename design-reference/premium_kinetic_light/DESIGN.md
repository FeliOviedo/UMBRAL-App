---
name: Premium Kinetic Light
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1b1b1b'
  on-surface-variant: '#4c4546'
  inverse-surface: '#303030'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5c5f63'
  on-secondary: '#ffffff'
  secondary-container: '#e0e2e7'
  on-secondary-container: '#626569'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e0e2e7'
  secondary-fixed-dim: '#c4c6cb'
  on-secondary-fixed: '#191c1f'
  on-secondary-fixed-variant: '#44474b'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
  surface-variant: '#e2e2e2'
  zone-1: '#4ECDC4'
  zone-2: '#86E3CE'
  zone-3: '#D1FFAD'
  zone-4: '#FFD166'
  zone-5: '#FF8C42'
  zone-6: '#FF595E'
  zone-7: '#C06C84'
  ui-accent: '#A7D626'
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

The design system is a high-performance evolution of the "Premium Athletic" aesthetic, adapted for a **Light Mode** environment. It maintains the core identity of clinical, aggressive precision while shifting the visual context to one of "Airy Technicality." 

The brand personality remains performance-obsessed and focused, but the transition to a light palette evokes a sense of clarity and medical-grade instrumentation. It targets athletes who require data to be presented with the highest possible contrast for outdoor or high-glare visibility. The design style is **Minimalism** with a **High-Contrast** focus—relying on generous whitespace and massive typography rather than decorative UI elements to convey status and importance.

## Colors

The palette shifts from a "void" to a "sterile" foundation, utilizing extreme tonal ranges to preserve the aggressive hierarchy of the original system.

- **Surface & Background:** Pure whites (#FFFFFF) and very light grays (#F7F8F9) are used to create a clean, high-visibility canvas that mimics physical lab reports or modern instrument displays.
- **Primary (Pure Black):** In this light variant, Black (#000000) becomes the primary color for all hero typography and core action triggers, ensuring maximum contrast ratio against the white surface.
- **UI Accent (Electric Lime):** Retained as a functional highlight (#A7D626) for active states, progress indicators, and focus rings.
- **Thermal Scale (Z1-Z7):** These colors remain identical to the original system to maintain semantic consistency for physiological data across modes. They should only be used for data visualization and never as decorative UI elements.
- **Neutral/Muted:** Medium grays (#8E937C) are reserved for metadata and descriptors to keep them secondary to the primary data.

## Typography

The typographic strategy utilizes extreme contrast in both size and weight.

1. **Archivo Black:** The engine of the design system. Used for "Giant Hero Data" and primary headlines. It must feel heavy, technical, and authoritative.
2. **Inter:** The functional workhorse. Used for descriptions, labels, and standard UI text. It provides a neutral counterpoint to the aggressive headline font.
3. **IBM Plex Mono:** Used for secondary metrics and tabular data. The monospaced nature ensures that values don't "jump" during live updates, maintaining visual stability.

All labels use `label-caps` and should be styled in a muted gray to prioritize the raw data values.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a "Negative Space First" philosophy. Because the system lacks heavy borders or cards, whitespace is the primary tool for grouping content.

- **Vertical Rhythm:** Use `section-gap` (64px) to define major content blocks. 
- **Margins:** A strict 24px margin is enforced on all edges to ensure the UI feels "premium" and never cluttered.
- **Data Centricity:** For "In-Run" or active tracking views, single metrics are center-aligned and oversized. For dashboard views, a multi-column fluid grid is used, with metrics left-aligned to their descriptors.

## Elevation & Depth

This system intentionally avoids depth metaphors like shadows or blurs to maintain its clinical minimalist aesthetic.

- **Tonal Layers:** Depth is achieved through subtle tonal shifts. The primary background is #FFFFFF, while secondary containers or "wells" use #F7F8F9.
- **Low-Contrast Outlines:** Where separation is strictly necessary (e.g., in a complex data table), use a 1px solid line in a very light gray (#E1E2EA).
- **Active Focus:** Instead of lifting an element, "Focus" is indicated by a color shift to the Electric Lime accent or a bold 2px underline.

## Shapes

The shape language is **Sharp and Geometric**, reflecting an engineered, technical product.

- **Hard Edges:** All buttons, input fields, and structural containers use 0px corners. This reinforces the aggressive, high-performance brand persona.
- **Interactive Pill:** The full-pill radius (100px) is the sole exception, used only for status chips or filter toggles to distinguish them as interactive, tactile objects.

## Components

- **Buttons:** Large and rectangular with 0px radius. Primary buttons are solid Black with White text. Secondary buttons are White with a Black 1px border.
- **Inputs:** A minimalist 1px bottom border (#000000). When focused, the border thickness increases to 2px and changes to the UI Accent (Electric Lime).
- **Data Chips:** Use the full-pill shape. For physiological intensity, use the Zone colors as the background with high-contrast text (Black or White depending on the zone's lightness).
- **Cards:** Avoid traditional cards. Group related data with whitespace. If a container is required, use a light gray (#F7F8F9) background with no border or shadow.
- **Data Visualization:** Line charts use a 2px solid Black stroke. Thermal data uses the Z1-Z7 color scale for the stroke. Points of interest are marked with 4px squares rather than circles.
- **Hero Metrics:** The visual anchor of any screen. A massive value in Archivo Black paired with a `label-caps` descriptor in a muted gray.