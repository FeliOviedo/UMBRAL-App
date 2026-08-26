---
name: UMBRAL Visual Identity Hybrid
colors:
  surface: '#0f141c'
  surface-dim: '#0f141c'
  surface-bright: '#343943'
  surface-container-lowest: '#090e16'
  surface-container-low: '#171c24'
  surface-container: '#1b2028'
  surface-container-high: '#252a33'
  surface-container-highest: '#30353e'
  on-surface: '#dee2ee'
  on-surface-variant: '#c4c9af'
  inverse-surface: '#dee2ee'
  inverse-on-surface: '#2c313a'
  outline: '#8e937c'
  outline-variant: '#444935'
  surface-tint: '#a7d626'
  primary: '#ffffff'
  on-primary: '#273500'
  primary-container: '#c2f344'
  on-primary-container: '#526d00'
  inverse-primary: '#4d6700'
  secondary: '#c4c6cd'
  on-secondary: '#2e3036'
  secondary-container: '#44474d'
  on-secondary-container: '#b3b5bc'
  tertiary: '#ffffff'
  on-tertiary: '#2c3139'
  tertiary-container: '#dee2ee'
  on-tertiary-container: '#60646e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c2f344'
  primary-fixed-dim: '#a7d626'
  on-primary-fixed: '#151f00'
  on-primary-fixed-variant: '#394d00'
  secondary-fixed: '#e1e2ea'
  secondary-fixed-dim: '#c4c6cd'
  on-secondary-fixed: '#191c21'
  on-secondary-fixed-variant: '#44474d'
  tertiary-fixed: '#dee2ee'
  tertiary-fixed-dim: '#c2c6d2'
  on-tertiary-fixed: '#171c24'
  on-tertiary-fixed-variant: '#424750'
  background: '#0f141c'
  on-background: '#dee2ee'
  surface-variant: '#30353e'
  electric-lime: '#CDFF4F'
  deep-obsidian: '#0B0E13'
  slate-surface: '#1B2028'
  thermal-z1: '#5CD7E6'
  thermal-z2: '#A7D626'
  thermal-z3: '#F3E044'
  thermal-z4: '#FFB3B3'
  thermal-z5: '#FF3B3B'
typography:
  display-hero:
    fontFamily: Archivo Black
    fontSize: 80px
    fontWeight: '900'
    lineHeight: 80px
    letterSpacing: -0.04em
  display-hero-mobile:
    fontFamily: Archivo Black
    fontSize: 48px
    fontWeight: '900'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Archivo Black
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: -0.01em
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
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  metric-sm:
    fontFamily: Archivo Black
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 24px
spacing:
  unit: 4px
  margin-mobile: 24px
  margin-desktop: 64px
  section-gap: 48px
  element-gap: 16px
---

## Brand & Style

This design system embodies **Premium Kinetic Minimalism**, a hybrid aesthetic that merges the raw, high-impact energy of performance athletics with a disciplined, technical dark-mode environment. The visual narrative is built on the concept of "The Void and the Spark"—where a deep, obsidian foundation allows high-voltage data metrics to command absolute attention.

The style is characterized by:
- **Kinetic Minimalism:** A spacious, container-less layout that removes visual clutter to focus on movement and essential data.
- **Instrumental Precision:** Interfaces feel like high-end scientific equipment, utilizing sharp typography and neon accents to imply speed and accuracy.
- **Technical Dark Mode:** A sophisticated palette designed for high-contrast legibility in low-light environments, evoking the feeling of a professional race cockpit.

## Colors

The palette is engineered for maximum "pop" against a near-infinite dark background. 

- **Primary (Electric Lime):** The primary signal color, reserved for critical data, active states, and calls to action. It represents peak performance and "high-voltage" energy.
- **Neutral Strategy:** Typography and icons use varying weights of `#DEE2EE` to ensure readability without the harshness of pure white.
- **Thermal Scale (Z1-Z5):** A semantic neon-on-dark gradient used exclusively for intensity metrics. These colors progress from cool cyans (recovery) to searing reds (peak effort), allowing for instant subconscious processing of effort levels.
- **Surface Depth:** While the layout is minimalist and often container-less, tertiary slate shades provide subtle structural grounding for secondary information.

## Typography

The typographic hierarchy is the primary driver of visual impact in this design system.

- **Archivo Black (Impact):** Used for "Hero Metrics" and primary headlines. Its massive weight and tight tracking create a sense of power and urgency. Use the `display-hero` scale for real-time performance data.
- **Inter (Utility):** Used for all UI labels, body text, and secondary navigation. Inter provides a neutral, highly readable counterpoint to the aggressive headline style.
- **Data Styling:** Large-scale metrics should always prioritize the `display-hero` tokens. For smaller data points (e.g., secondary stats in a list), use `metric-sm` to maintain the brand’s high-impact character.

## Layout & Spacing

This design system utilizes a **Fluid Layout** with a "container-less" philosophy. Information is grouped by proximity and typographic weight rather than heavy boxes.

- **Negative Space:** Generous margins (24px on mobile, 64px+ on desktop) are mandatory to maintain the premium, minimalist feel. 
- **Rhythm:** A strict 4px grid governs all internal spacing. Use `section-gap` to separate distinct data clusters and `element-gap` for items within a single category.
- **Breakpoints:** On mobile, the layout reflows into a singular vertical stream of high-impact metrics. On desktop, content utilizes the horizontal axis to display multi-axis charts and detailed telemetry side-by-side.

## Elevation & Depth

To maintain the **Minimalist Hybrid** aesthetic, this design system avoids traditional drop shadows and physical skeuomorphism.

- **Luminance Layering:** Depth is achieved by placing elements on a "Thermal Stack." The base is always `#0B0E13`. Overlays and temporary panels use `#1B2028`.
- **Electric Glow:** Interactive elements do not lift; they "activate." Use a subtle outer glow of the `primary-color` (3-5px blur, low opacity) to indicate focus or active states.
- **Outline Definition:** Where separation is required (e.g., in complex charts), use 1px hair-line borders in `#343942`.

## Shapes

The shape language is **Sharp (0px)**. To align with the technical, brutalist influence of high-performance gear, all buttons, containers, and data blocks use 90-degree corners. This creates a rigorous, architectural feel that distinguishes the system from friendlier, consumer-grade apps. 

Exception: Progress rings and specific circular biometric icons maintain their geometric form but do not use corner radii.

## Components

- **Action Buttons:** Large, rectangular blocks. Primary buttons use a solid `electric-lime` background with `deep-obsidian` Archivo Black text. Secondary buttons use a 2px `electric-lime` border with no fill.
- **Hero Metrics:** Standalone units of data. The value is presented in `display-hero` (Archivo Black) with the `label-caps` (Inter) descriptor placed strictly above or below the value.
- **Kinetic Charts:** Graphs should use the "vivid-on-dark" style. Line charts use a 3px stroke in a thermal scale color. Fill the area under the line with a vertical gradient fading from 20% opacity to 0%.
- **Status Chips:** Rectangular tags with a 1px border. Use `label-caps` for the text. Use the thermal color scale to indicate intensity or status.
- **Input Fields:** Minimalist under-line style. A 2px bottom border in `slate-surface` that transitions to `electric-lime` on focus.
- **Progress Bars:** Ultra-thin (4px) tracks. The background track is `#1B2028`, and the active progress is a solid `electric-lime` glow.