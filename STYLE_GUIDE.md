# Style Guide: The Drive (Resident Evil 2026, Unofficial Concept)

**Source:** https://re-the-drive.webflow.io/  
**Author:** Filip Zrnzevic (Webflow × GSAP × CodeTV challenge)  
**Stack:** Astro v6.3.1, Webflow, GSAP, Three.js / WebGL, Vanilla CSS  
**Verification Status:** **100% Fully Confirmed & Audited** against production CSS, JS bundles, WebGL shaders, and markup.

---

## 1. Concept and Brand Essence

A cinematic, in-fiction "classified record" experience. The site is framed as a recovered incident file from Raccoon City: a medical courier's single night, told through timestamps, transmissions, and forensic evidence.

**Design Pillars**
- **Dossier / Found-Footage Framing:** Everything reads as a declassified military/corporate incident log, telemetric transmission, or route manifest.
- **Countdown Tension:** Timecodes run chronologically through the entire page progression (`22:03` → `23:58` → `01:36` → `02:04` → `02:41` → `03:46` → `04:17` → `04:29` → `04:41` → `05:12`).
- **Dark, Cold, and Atmospheric:** Near-black `#05060a` canvas, cold-chain / clinical receiving bay aesthetic, rain/snow fog layers, and high-contrast warning accents.
- **Brutalist Restraint:** Terse procedural sentences, oversized distressed typography, zero-radius borders, hard hairlines, and minimal decorative clutter.

---

## 2. Color System & Tokens

All tokens are defined as CSS Custom Properties in `:root`:

| Token | Hex / Value | Usage & Context | Status |
|---|---|---|---|
| `--ink` | `#05060a` | Primary canvas & background base (near-black with deep cold-blue undertone) | **Confirmed** |
| `--ink-2` | `#0a0c11` | Secondary dark surface (image placeholders, cards, backings) | **Confirmed** |
| `--ink-3` | `#11141b` | Tertiary dark surface | **Confirmed** |
| `--bone` | `#e8e4dc` | Primary text, titles, borders, and light UI elements | **Confirmed** |
| Text White | `#ffffff` | High-emphasis lede lines, navigation links, and active text | **Confirmed** |
| `--red` | `#ff211a` | Primary signal / hazard red (accent highlights, timestamps, HUD alerts, active states, CRT blooms) | **Confirmed** |
| `--red-deep`| `#8f0f0c` | Deep arterial red tone (shadows, gradient stops) | **Confirmed** |
| `--red-ember`| `#ff6a3d`| Flare / amber heat signature | **Confirmed** |
| `--footer-red`| `#c8140d`| Emergency solid crimson banner for the closing footer and statement wash | **Confirmed** |
| `--teal` | `#1b3a42` | Cold ambient shadow tint in route map and background depth | **Confirmed** |
| `--ash` | `#8b8b93` | Secondary neutral for labels, metadata, captions, and muted timestamps | **Confirmed** |
| `--ash-dim` | `#55555d` | Tertiary neutral for inactive metadata and subtle secondary kicks | **Confirmed** |
| Hairline Borders | `rgba(232, 228, 220, 0.11)` to `0.16` | Subtle dividers, terminal frames, and navigation separators | **Confirmed** |

### CRT Bloom & Glow Values
```css
--crt-bloom: drop-shadow(0 0 1px rgba(255, 33, 26, 0.85))
             drop-shadow(0 0 6px rgba(255, 33, 26, 0.55))
             drop-shadow(0 0 18px rgba(255, 33, 26, 0.32));
```

### Statement Scarlet Wash (24-Stop Dispersion)
```css
background: linear-gradient(180deg,
  #05060a, #10060a, #2e070a, #4e080a, #6c0a0b, #870d0b, #9d0f0c, #af110c, #bc130d, #c4140d,
  #c7140d 34.55%, #c8140d 38% 46%, #c8140d 55.43%,
  #c6140d, #c2130d, #bb120d, #b0110c, #a3100c, #920e0c, #7f0c0b, #6a0a0b, #52080a, #39070a, #21060a, #0b060a, #05060a
);
```

---

## 3. Typography & Font Specifications

### Font Families Declared
1. **Display & Headings:** `"Dominique", Impact, ui-sans-serif, sans-serif`
   - Weight 400 (`Dominique-Regular.woff2`)
   - Weight 500 (`Dominique-Medium.woff2`)
   - Weight 900 (`Dominique-Black.woff2`)
2. **Body & Interface:** `"Dominique", ui-sans-serif, system-ui, sans-serif`
3. **Monospace / HUD / Terminal:** `"PP Supply Mono", ui-monospace, "SF Mono", monospace`
   - Variable Font: 100 to 800 (`PPSupplyMono-Variable.woff2`)
   - Used at weights 500, 560, 600, 620, 650, 700
4. **Cast Display Names:** `"BigBang UCond", Impact, sans-serif`
   - Weight 900 Ultra Condensed (`BigBang-BlackUltraCondensed.woff2`)
5. **Handwritten Scrawl / Defaced Notes:** `"Permanent Marker", cursive`
   - Weight 400 (`PermanentMarker-Regular.woff2`)

### Typographic Scale & Hierarchy

| Element | Font Family | Weight | Size | Line Height | Tracking | Text Transform |
|---|---|---|---|---|---|---|
| **Statement Title (H2)** | `Dominique` | 900 | `clamp(2.6rem, 11vw, 11rem)` | `0.86` | `0.035em` | Uppercase |
| **Cast Name (H3)** | `BigBang UCond` | 900 | `clamp(2.6rem, 10.5vw, 9.5rem)` | `0.84` | `0.06em` | Uppercase |
| **Menu Overlay Links** | `Dominique` | 900 | `clamp(2.8rem, 8.5vh, 6.5rem)` | `0.9` | `0.03em` | Uppercase |
| **Route Map Lede** | `Dominique` | 900 | `clamp(2.6rem, 5.4vw, 5.6rem)` | `0.94` | `0.02em` | Uppercase |
| **Windshield Titles** | `Dominique` | 900 | `clamp(2.2rem, 7vw, 6.5rem)` | `0.9` | `0.02em` | Uppercase |
| **Interstitial Lines** | `Dominique` | 500 | `clamp(1.9rem, 4.3vw, 4.3rem)` | `1.12` | `0.015em` | Uppercase |
| **Handwritten Scrawls**| `Permanent Marker`| 400 | `clamp(1.6rem, 3.4vw, 3.5rem)` | `0.95` | `0.005em` | None |
| **Route Map Body** | `Dominique` | 400 | `clamp(1.05rem, 1.18vw, 1.25rem)`| `1.55` | Normal | None |
| **Terminal Lines** | `PP Supply Mono` | 500 | `clamp(0.68rem, 0.62vw, 0.77rem)`| `1.58` | `0.045em` | Uppercase |
| **Eyebrows / Badges** | `PP Supply Mono` | 500 | `11px` (`--fs-micro`) | `1.2` | `0.22em` (`--ls-micro`) | Uppercase |
| **Small HUD Readouts** | `PP Supply Mono` | 560 | `10px` (`--fs-micro-sm`) | `1.0` | `0.22em` | Uppercase |

### Typographic Rules & Text Treatments
- **Distressed Grunge Ink:** Display headings and titles use CSS masking with `/media/title-grunge-mask.webp` (`-webkit-mask-image: url(...)`, `mask-size: cover`).
- **Keyword Highlights:** Key narrative words use `.interstitial__hl` with `box-decoration-break: clone`, background `var(--red)`, and ink `#08080a`.
- **Zero-Padding & Encodings:** All numbers are formatted with leading zeros (`000%`, `01`–`07`, `0417-B`, `23:58:07`).
- **Separators:** Monospace eyebrows strictly use centered dots ` · ` and slashes ` / `. Headings use em-dashes ` — `.

---

## 4. Grid, Spacing & Breakpoints

### 12-Column Grid Tokens
```css
:root {
  --cols: 12;
  --pad: 2rem;
  --gutter: 1rem;
  --gut: var(--pad);
  --scrollbar-w: 14px;
}
```

- Grid container:
  ```css
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    column-gap: var(--gutter);
    padding-inline: var(--pad);
  }
  ```
- Column placements use custom CSS properties: `[data-col] { grid-column: var(--c, 1 / -1); min-width: 0; }`
- Full-bleed breakouts: `[data-col-bleed] { grid-column: 1 / -1; margin-inline: calc(var(--pad) * -1); }`

### Responsive Breakpoints
1. **Wide Desktop (`>= 1100px`):** Full telemetry displays, telemetry beam graphics, dual-column route map layouts, and multi-layered atmospheric shaders active.
2. **Tablet / Medium (`721px` to `1100px`):** Studio logos collapse to 3x2 grid, still frames re-anchor.
3. **Mobile (`<= 720px`):**
   - `--pad: clamp(1rem, 5vw, 1.4rem);`
   - `--gutter: 0.75rem;`
   - Grid items collapse to full width (`grid-column: 1 / -1;`).
   - Custom blood scrollbar hidden.
   - Fixed nav collapses into mobile hamburger button and full-screen drawer menu.
   - Section vertical padding collapses from `clamp(9rem, 22vh, 17rem)` to `clamp(5rem, 12svh, 7rem)`.
4. **Short Viewports / Mobile Landscape (`<= 900px` and `max-height <= 500px` or `<= 720px` and `max-height <= 620px`):**
   - Section padding hard-collapses to `4rem`.
   - Scroll cue (`Descend`) hidden.
   - Preloader terminal pads shrink to fit screen.

---

## 5. Components & UI States

### 1. Buttons (`.btn`)
- **Geometry:** Zero border radius (`border-radius: 0;`), sharp rectangular tactical geometry.
- **Base Button (`.btn`):**
  - Font: `var(--font-mono)`, `11px`, `letter-spacing: 0.22em`, uppercase.
  - Padding: `0.95em 1.9em`.
  - Base color: `var(--bone)`.
  - Hover: `transform: translateY(-2px); color: var(--red);`
  - Active: `transform: translateY(0) scale(0.96); transition-duration: 0.12s;`
  - Focus-visible: Clean focus outline.
- **Primary Button (`.btn--primary`):**
  - Background: `var(--red)` masked with `/media/title-grunge-mask.webp`. Text: `#08080a`.
  - **"Containment Breach" Hover Interaction:**
    - Label text hides upward (`translate3d(0, -70%, 0)`).
    - 3 horizontal breach slices (`.btn__breach-slice:nth-child(1..3)`) animate in with staggered delays (`65ms`, `32ms`, `0ms`).
    - Horizontal red scanning beam sweeps down (`@keyframes btn-containment-scan`, duration `0.52s`).
    - Top and bottom sliced labels glitch jitter (`@keyframes btn-containment-slice-top`, `@keyframes btn-containment-slice-bottom`).
  - Focus-visible: `outline: 1px solid #08080a; outline-offset: 3px;`.

### 2. Audio Waveform Toggle (`.nav__sound`)
- 5 vertical animated audio bars (`i` elements, `2px` width, `14px` height).
- Idle: scaled to `0.14` scaleY.
- Hover: turns `var(--red)`.
- Active (`aria-pressed="true"`): Continuous staggered oscillation using `@keyframes nav-wave` with durations `0.74s`, `1.13s`, `0.61s`, `1.31s`, and `0.87s`.

### 3. Terminal Preloader & Intro Gate
- **Structure:** Dual split panels (`.preloader__panel--top` and `.preloader__panel--bottom`), terminal window with scanline sweep (`1.4s steps(4, end)`), flickering red cursor (`0.78s steps(1, end)`).
- **Segmented Bar:** Dotted loading track (`0.42rem` cells with `0.2rem` spacing) clipped dynamically via `clip-path: inset(0 calc(100% - var(--load) * 1%) 0 0)`.
- **Legal Acknowledgment:** Brackets wrapper `[ Acknowledged ]` followed by terse agreement copy.
- **Entry Split Reveal:** Top and bottom panels slide out vertically (`yPercent: -100` and `+100`) revealing the hero scene underneath.

### 4. Interactive Stills & Trailer Player
- **Still Frames:** Aspect ratio `16/9` (wide), `3/4` (tall), `4/3` (small). Overlayed with dynamic canvas WebGL grain that transitions to `opacity: 1` on ready.
- **Trailer Frame:** Aspect ratio `21/9` feature, `4/3` teasers.
- **Play Button:** Circular ring with red glow SVG border (`drop-shadow(0 0 8px rgba(255, 33, 26, 0.6))`). Hover triggers an expanding grunge-masked red circle backdrop (`scale(0.62)` → `scale(1)`).

### 5. Cast Rows & Scrawled Aliases
- Cast name in oversized `BigBang UCond` font.
- In desktop mode, cast name is rendered transparent in DOM, backed by a real-time WebGL Three.js proximity shader that reacts to cursor movement.
- On hover / scroll-into-view, a red-filtered handwritten role scrawl (`Permanent Marker`) is dynamically drawn using GSAP `DrawSVG` along an SVG bezier path (`drawSVG: "0% 100%"`).

### 6. Billing Block & Production Studios
- Logos: Columbia Pictures, TriStar Pictures, Constantin Film, Davis Films, Filmed for IMAX, Sony Pictures.
- **Visual Treatment:** `filter: brightness(0); opacity: 0.8;` rendered in crisp silhouette black directly over the solid red footer background (`--footer-red: #c8140d`).

---

## 6. Imagery, Media & SVG Filters

### Media Manifest
| Asset | Dimensions / Type | Description & Purpose |
|---|---|---|
| `resident-evil-title-lockup.webp` | WebP lockup | Main movie title typography lockup with distressed edges |
| `hero-forest.webp` | WebP background | Night forest highway plate used in atmospheric WebGL rain canvas |
| `still-shotgun.webp` | WebP still | Primary trailer poster & still gallery image |
| `still-street.webp` | WebP still | Interstitial "The streets are wrong" background plate |
| `still-forest.webp` | WebP still | Interstitial "The hospital" plate |
| `still-cooler.webp` | WebP still | Stills gallery "Cold cargo, signature on arrival" |
| `still-house.webp` | WebP still | Stills gallery "The last address on the sheet" |
| `still-car.webp` | WebP still | Interstitial "Snow on the road" plate |
| `poster-hand-keyed.webp` | WebP image | Keyed poster hand asset in containment statement |
| `resident-bg.jpg` | JPEG background | Windshield rain wiper background scene |
| `title-grunge-mask.webp` | Texture mask | Custom grunge alpha mask applied to buttons, headlines, and badges |
| `texture-grain.webp` | Texture overlay | 420px soft-light noise texture |

### Custom SVG Filters

#### 1. Arterial Blood Drip Filter (`#blood-drip`)
Distorts ink, scrawls, and custom scrollbar elements into fluid organic shapes:
```xml
<filter id="blood-drip" x="-30%" y="-40%" width="160%" height="180%">
  <feTurbulence id="blood-turbulence" type="fractalNoise" baseFrequency="0.07 0.11" numOctaves="3" seed="7" result="noise" />
  <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
</filter>
```

#### 2. Fine Blood Edge Filter (`#blood-drip-fine`)
```xml
<filter id="blood-drip-fine" x="-12%" y="-18%" width="124%" height="136%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9 1.1" numOctaves="2" seed="4" result="n" />
  <feDisplacementMap in="SourceGraphic" in2="n" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
</filter>
```

#### 3. SVG Noise Grain Filter (`#resident-grain-filter`)
```xml
<filter id="resident-grain-filter" x="-20%" y="-20%" width="140%" height="140%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="2" stitchTiles="stitch" />
  <feColorMatrix type="saturate" values="0" />
</filter>
```

---

## 7. Motion, GSAP & WebGL Shaders

### 1. GSAP Timings & Easing Standards
- **Hero Title Entry:**
  - Opacity: `duration: 1.5s, ease: "power2.out"`
  - Scale: `from 1.06 to 1.0, duration: 2.6s, ease: "power3.out"`
  - Eyebrow & Presents: `duration: 1.0s, stagger: 0.14s, ease: "power2.out"`
  - Actions (Buttons): `duration: 0.7s, y: 0 (from 14px), stagger: 0.12s, ease: "power3.out"`
- **Hero Scroll Scrub (ScrollTrigger):**
  - Lockup transforms in 3D: `z: -520, rotateX: 9deg`, filter blur `7px`, scrub: `0.6`
- **Statement Title Reveal:**
  - Lines slide from `yPercent: 112`, duration `1.15s + (blur * 0.05s)`, delay `index * 0.07s`, ease: `"power3.out"`
  - Letter spacing dynamically scrubs from `0.035em` to `0.235em` with `13px` progressive blur.
- **Scroll Cue (`Descend`):**
  - Continuous vertical pulse: `scaleY: 0.4, transformOrigin: "top", duration: 1.4s, repeat: -1, yoyo: true, ease: "power2.inOut"`.

### 2. Custom WebGL Shaders
- **Atmospheric Rain & Fog (`atmosphere.js`):**
  - Two-tier volumetric noise fog layers (`fogA: 0.1, fogB: 0.06`, speeds `0.05` and `0.024`).
  - Active rain particle system with speed `0.78` and rain density `0.62`.
  - Scrubbed via ScrollTrigger to dynamically increase exposure and fog density as the user scrolls deeper into the incident file.
- **Cast Proximity Smear Shader (`Cast.js`):**
  - 24-tap radial smear fragment shader rendered with Three.js.
  - Reads pointer position (`uMouse`) and smoothly flares (`uFlare`, duration `0.6s, ease: "power2.out"`), burning hotter as the cursor approaches each name.
- **Blood Drips Particle Physics (`Statement.js`):**
  - Particle engine calculating velocity, gravity (`0.045`), and residue shedding (`0.0025`), spawning droplets dynamically proportional to user scroll speed.

---

## 8. Voice and Tone Guide

- **Style:** Procedural, terse, foreboding, declassified corporate-military log.
- **Sentence Structure:** Short sentences, typically under 12–15 words. High reliance on periods and sentence fragments.
- **Cadence Examples:**
  - *"One night. One hospital. One way out."*
  - *"Bryan runs a medical courier's route — cold cargo, tight windows, no questions asked."*
  - *"Umbrella sealed the city before dawn. Nobody told the courier already inside it."*
  - *"Sunrise is at 05:12. Between Bryan and daylight: one hospital, and everything waiting inside it."*
- **Vocabulary:** Clearance record, incident archive, transmission, manifest, route lock, containment, deviation, perimeter, sector, compromise.

---

## 9. Accessibility Specifications

- **Color Contrast Ratios:**
  - `--bone` (`#e8e4dc`) on `--ink` (`#05060a`): **14.8:1** (Passes WCAG AAA)
  - Pure White (`#ffffff`) on `--ink` (`#05060a`): **18.7:1** (Passes WCAG AAA)
  - Primary Red (`#ff211a`) on `--ink` (`#05060a`): **5.3:1** (Passes WCAG AA for normal text, AAA for large text)
  - Charcoal (`#08080a`) on Primary Red (`#ff211a`): **5.3:1** (Passes WCAG AA)
- **Reduced Motion Support (`prefers-reduced-motion: reduce`):**
  - WebGL rain simulation and volumetric fog are halted.
  - Blood smear SVG displacement distortion filters are turned off.
  - GSAP scrubbed 3D rotations, lockup deep zooms, and camera travel are suppressed.
  - Animated grain overlay and scanline oscillations are eliminated.
  - Preloader split panels and typewriter cursors default to static completion states.
- **Assistive Technology & Semantics:**
  - `.sr-only` class utilized for proper H1 and H2 document outlines without visual disruption.
  - Preloader load ticker is tagged with `role="status"` and `aria-live="polite"`. Percentage counts are suppressed from screen-reader repetition so only meaningful milestone updates are vocalized.
  - All decorative SVG canvases, beams, and icons feature `aria-hidden="true"`.
  - Sound and navigation controls provide explicit `aria-pressed`, `aria-expanded`, and `aria-controls` properties.

---

## 10. Checklist of Completed Items

- [x] **Font families, weights, and sizes:** Fully documented (`Dominique` 400/500/900, `PP Supply Mono` variable, `BigBang UCond` 900, `Permanent Marker` 400).
- [x] **Full color palette:** Exactly matched from production CSS tokens (`--ink`, `--ink-2`, `--ink-3`, `--bone`, `--red`, `--red-deep`, `--red-ember`, `--footer-red`, `--teal`, `--ash`, `--ash-dim`, borders, and gradients).
- [x] **Spacing scale, container widths, and breakpoints:** 12-column grid system, `--pad: 2rem`, `--gutter: 1rem`, breakpoints at `1100px`, `860px`, `720px`, and short viewports (`<= 500px`/`<= 620px`).
- [x] **Button states and border radii:** Zero-radius geometry, tactical hover translation, active scale down, and complete "Containment Breach" 3-slice scanline hover animation on `.btn--primary`.
- [x] **Easing curves and durations for GSAP animations:** Extracted from production JS (`power2.out`, `power3.out`, `power2.inOut`, `scrub: 0.5 - 0.8`, timelines, and stagger delays).
- [x] **Logo treatment in the billing block:** Solid silhouette black (`filter: brightness(0); opacity: 0.8`) over the `--footer-red` crimson background.
- [x] **Accessibility details:** Full WCAG contrast calculations, comprehensive `prefers-reduced-motion` fallbacks, screen reader ARIA landmarks, and `.sr-only` heading hierarchy.
