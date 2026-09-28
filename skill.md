---
name: add-3d-paper
description: "Build 3D Paper from its verified authored source using Bundled Three.js r149 + custom GLSL + CanvasTexture, including the complete renderer, interactions, and required assets. Use when Codex needs to implement, port, or adapt this effect without requiring the ThreeUI package or reconstructing the visual from an approximation."
---

# Build 3D Paper

## Description

Four translucent 3D paper certificates that bend like suspended glass, spanning the original Nocturne edition, Site of the Year, Japanese recognition, and a formal certificate design.

Recreate the authored behavior from the verified source, not from screenshots or the abbreviated orchestration sample in this skill. The implementation may live directly in the target project and does not require `@designcodeio/threeui`.

## Technologies

- React sandbox host
- Byte-exact authored HTML
- Bundled Three.js r149
- Custom paper-deformation GLSL
- Procedural CanvasTexture certificate
- Fresnel and physical glass shading
- Visibility-aware lifecycle

## Verified source material

- `src/shaders/3d-paper/sources/3d-paper.html — byte-exact original interaction`
- `src/shaders/3d-paper/sources/3d-paper-site-of-the-year.html — byte-exact variant`
- `src/shaders/3d-paper/sources/3d-paper-japanese.html — byte-exact variant`
- `src/shaders/3d-paper/sources/3d-paper-certificate.html — byte-exact variant`
- `src/shaders/3d-paper/ThreeDPaper.tsx`

Source revision: `SHA-256 8ec1b71c0dbc`

## Implementation steps

1. Open every verified source file listed above and identify the renderer, host lifecycle, styles, and assets before editing.
2. Keep all four 3D Paper HTML documents byte-for-byte, including the original, Site of the Year, Japanese, and Certificate artwork plus their bundled Three.js runtime, procedural environment and grain, paper deformation shader, lighting, halo, blur, and vignette.
3. Mount the document in an opaque allow-scripts-only sandbox so the authored Google Fonts URLs load without exposing the host.
4. Preserve pointer parallax, paper hit testing, hover illumination, grab-and-drag rotation, inertial release, nearest-turn settling, responsive framing, and reduced-motion behavior.
5. Retain the subdivided paper geometry, arc-length-conserving bend integration, reconstructed normals, physical glass material, Fresnel alpha treatment, and procedural textures instead of flattening the certificate into a static image.
6. Unmount the iframe whenever its host or document is hidden so route changes release the renderer and animation loop.
7. Give the local component a sized, overflow-controlled parent and verify desktop, mobile, reduced-motion, and context-loss behavior.

Asset handling: This effect has no required external assets.

## Local component example

Import the copied local component rather than a package entrypoint:

```tsx
import { ThreeDPaper } from "./effects/3d-paper/ThreeDPaper";
import "./effects/3d-paper/styles.css";

export function Scene() {
  return <div className="effect-frame"><ThreeDPaper /></div>;
}
```

## Core renderer pattern

This excerpt documents orchestration only. Copy the exact shader, geometry, pass, and interaction code from the verified source files.

```tsx
<ThreeDPaper variant="site-of-the-year" />
```

## Behavior contract

- Runtime: Bundled Three.js r149 + custom GLSL + CanvasTexture
- Passes: Single WebGL scene render with a translucent certificate plane, procedural environment, halo, grain, blur, and vignette layers
- Interaction: Pointer parallax, paper hit testing, hover light, grab-and-drag rotation, inertial release, nearest-turn settling, responsive framing, and reduced-motion support
- Assets: Three.js r149 is bundled inside the canonical HTML; the certificate, environment, halo, grain, and textures are procedural Canvas 2D while the two authored Google Fonts load from their original URLs
- **documents** (fixed): Four complete owner-supplied HTML scenes, byte-for-byte
- **variant** (choice): Original | Site of the Year | Japanese | Certificate
- **renderer** (sandbox): Opaque allow-scripts-only HTML document
- **paper** (original): Translucent bent certificate with procedural print and reflective shading
- **interaction** (original): Hover light + pointer parallax + grab-and-drag rotation + inertial settling
- **lifecycle** (adaptive): Iframe mounts only while its host and document are visible
- **assets** (embedded + procedural + remote fonts): Bundled Three.js r149; procedural Canvas textures; authored Google Fonts URLs

## Verification

1. Compare the rendered composition, animation timing, pointer behavior, and state transitions with the source implementation.
2. Exercise resize, high-DPI, mobile/coarse-pointer, reduced-motion, tab visibility, and WebGL context-loss paths where applicable.
3. Confirm every animation frame, observer, listener, geometry, buffer, texture, framebuffer, material, and renderer is released on teardown.
4. Check the browser console and confirm the effect renders at native-or-better backing resolution.

## Guardrails

- Do not substitute a visually similar package, demo, shader, or runtime.
- Do not approximate, reconstruct, or simplify the authored GLSL, render passes, geometry, interaction state, or assets.
- Keep exact source and asset hashes under regression tests when the source project provides them.
- Adapt only the surrounding host boundary needed by the target project; keep renderer behavior intact.
