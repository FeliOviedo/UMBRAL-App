---
name: UMBRAL Visual Identity
colors:
  surface: '#0f141b'
  surface-dim: '#0f141b'
  surface-bright: '#343942'
  surface-container-lowest: '#090e16'
  surface-container-low: '#171c24'
  surface-container: '#1b2028'
  surface-container-high: '#252a33'
  surface-container-highest: '#30353e'
  on-surface: '#dee2ee'
  on-surface-variant: '#c4c9af'
  inverse-surface: '#dee2ee'
  inverse-on-surface: '#2c3139'
  outline: '#8e937c'
  outline-variant: '#444935'
  surface-tint: '#a7d626'
  primary: '#ffffff'
  on-primary: '#273500'
  primary-container: '#c2f344'
  on-primary-container: '#526d00'
  inverse-primary: '#4d6700'
  secondary: '#5cd7e6'
  on-secondary: '#00363c'
  secondary-container: '#00a3b0'
  on-secondary-container: '#003237'
  tertiary: '#ffffff'
  on-tertiary: '#680016'
  tertiary-container: '#ffdad9'
  on-tertiary-container: '#c2213a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c2f344'
  primary-fixed-dim: '#a7d626'
  on-primary-fixed: '#151f00'
  on-primary-fixed-variant: '#394d00'
  secondary-fixed: '#8cf2ff'
  secondary-fixed-dim: '#5cd7e6'
  on-secondary-fixed: '#001f23'
  on-secondary-fixed-variant: '#004f56'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b3'
  on-tertiary-fixed: '#40000a'
  on-tertiary-fixed-variant: '#920023'
  background: '#0f141b'
  on-background: '#dee2ee'
  surface-variant: '#30353e'
typography:
  display-metrics:
    fontFamily: JetBrains Mono
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system for this application bridges the gap between high-performance athletic energy and scientific precision. The aesthetic is **Technical Minimalism**: a data-first approach that prioritizes legibility, expansive negative space, and a rigorous structural hierarchy.

The UI evokes a sense of "elite instrumentation"—utilitarian yet energized. It targets serious runners who view their performance through the lens of biological thresholds and data trends. The visual tone is focused, rhythmic, and high-contrast, utilizing a "Dark Mode" foundation to reduce eye strain during low-light runs and to allow the vibrant functional colors to pop with maximum urgency.

## Colors
This design system utilizes a high-contrast dark palette where the background acts as a void, pushing the data to the foreground.

- **Action & Brand:** The "Electric Lime" (#CDFF4F) is used exclusively for primary actions, current progress, and active states. It represents the "high-voltage" energy of the athlete.
- **Surface Strategy:** Use `#151A22` for cards and modals to create subtle depth against the `#0B0E13` base.
- **Functional Mapping:** The Zone Scale is a semantic heat map. These colors must be used strictly for intensity metrics (Heart Rate, Power, Pace) to ensure the user can interpret their effort at a glance without reading text.

## Typography
The typography system uses three distinct families to categorize information:
1.  **Space Grotesk (Headlines):** Provides a geometric, futuristic character for editorial and structural headers.
2.  **Inter (UI/Body):** Ensures maximum readability for instructions, settings, and general interface text.
3.  **JetBrains Mono (Metrics/Data):** Crucial for "tabular lining"—ensuring that numbers don't jump horizontally when updating rapidly in real-time.

Use `display-metrics` for the primary focus during a run (e.g., current pace or heart rate). Use `label-caps` for metadata descriptors above or below data points.

## Layout & Spacing
This design system follows a strict **8px grid** (with 4px increments for tight components). The layout is primarily a **Fluid Grid** that prioritizes vertical stacking on mobile to facilitate one-handed operation during activity.

- **Safe Zones:** Maintain a 20px margin on horizontal edges to ensure data isn't obscured by phone cases or bezel curves.
- **Rhythm:** Use `stack-lg` (32px) between unrelated sections (e.g., "Today's Plan" vs "Recent Activities") and `stack-sm` (8px) for internal card elements.
- **Data Density:** In the "In-Run" view, maximize the viewport for 1-3 primary metrics. Post-run analysis views should utilize a 2-column grid for secondary metrics.

## Elevation & Depth
In this design system, depth is communicated through **Tonal Layering** and **Low-Contrast Outlines** rather than traditional shadows.

1.  **Base Layer:** The deepest level is the `#0B0E13` background.
2.  **Surface Layer:** Cards and interactive containers use `#151A22`.
3.  **Stroke Definition:** All surfaces must have a 1px border of `#232B36` to define their boundaries against the dark background.
4.  **Active Elevation:** When an element is focused or active, use the primary color (#CDFF4F) as a 1px border or a subtle outer glow (0px 0px 8px) to simulate "lit" instrumentation. Avoid heavy blurs to maintain the technical, sharp aesthetic.

## Shapes
The shape language is controlled and modern.
- **Containers:** All primary cards and modals use a **16px (1rem)** corner radius, creating a "tech-hardware" feel.
- **Interactive Elements:** Buttons and input fields follow the `rounded-lg` (1rem) standard.
- **Small Components:** Chips and status tags should use the `rounded-xl` (1.5rem) or a full pill shape to differentiate them from larger structural blocks.

## Components
- **Primary Buttons:** High-visibility. Background: `#CDFF4F`; Text: `#0B0E13` (Bold). No shadows; the color provides the hierarchy.
- **Secondary Buttons:** Outline style. Border: `#CDFF4F` (1px); Text: `#CDFF4F`.
- **Cards:** Background: `#151A22`; Border: 1px `#232B36`; Corner Radius: 16px. Content within cards should have a 16px padding.
- **In-Run Metrics:** Use `JetBrains Mono`. Labels should be `label-caps` in `#9AA7B4`. Active metric values should be `text_primary`.
- **Iconography:** Use 2px outline icons. Icons should be monochrome (`#F4F6F8`) unless they represent a specific zone or a destructive action.
- **Data Visualization:**
    - **Line Charts:** 2px stroke width. Use gradients that fill the area under the line with 10% opacity of the line's color.
    - **Progress Rings:** 8px stroke thickness. Background track: `#232B36`. Active track: Primary or Zone color.
- **Chips/Badges:** Small, condensed. Use `label-caps` typography. For Zone badges, use the Zone color as a background with 15% opacity and a solid color border/text.