# Plan: readable text under the scrolling background block

## Context

The personal web app (`personal-web-app/`, Lit + Vite) renders `<background-svg>` behind every page. It holds the page background rect and one block (`#block1`, `fill="var(--color-main-text)"`, #F0F7F4) that animates across the screen. The whole SVG sits at `z-index: -1000`, so the block passes *behind* the text. Body text is also `--color-main-text`, so text over the block is white on white and disappears.

Goal: text the block passes over turns black (readable), per pixel, without changing the animation logic.

## Options considered

1. **`mix-blend-mode: difference` on a block layer above the content** (chosen). Output is |block − backdrop|: white block over white text → black; over the #32292f background → #BECEC5; colored text inverts (links #AF9085 → dark teal, primary #99E1D9 → dark red), still readable. Pure CSS, GPU composited, per pixel.
2. `backdrop-filter: invert(1)` on the block. Near-identical look, but needs an HTML `<div>` (no backdrop-filter on SVG elements), so the SVG animations would need rewriting. No advantage over 1.
3. JS hit-testing of text elements per frame. Per element, not per pixel, so half-covered text turns black over the dark background; forces layout every frame and must cross shadow roots.
4. A black clone of the content clipped to the block. Exact, but duplicates every page and the router output.

## Changes

### `src/components/background-svg.ts`

- Split `render()` into two fixed SVGs that share the `0 0 100 100` viewBox with `preserveAspectRatio="none"`:
  - `.background` (unchanged): the background `<rect>` only, `z-index: -1000`.
  - `.block-layer` (new): only `#block1`, rendered while `animated` is true. Styles: `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 5; pointer-events: none; mix-blend-mode: difference;`
- `#block1`, its `move-*` classes, `moveBlock`, `onBlockAnimationEnd` and the toggle behavior stay unchanged. The rect still lives in the component's shadow root, so `querySelector('#block1')` keeps working.

### Stacking order (no code change needed)

- `.background` -1000 < page content (auto/0) < `.block-layer` 5 < block toggle button 10 (stays un-inverted) < `pixel-transition` 1000 (still covers everything during page transitions).

### Isolation check

`mix-blend-mode` only blends with content inside the same isolated group. No element that contains the block (`background-svg` host → `app-main` → `body` → `html`) may set `isolation: isolate`, `transform`, `filter`, `opacity < 1`, `contain: paint/content`, `will-change` or `z-index`. Verified: none do. The `opacity` / `contain` rules in `about-page` and `gov-chat-page` are on page content beneath the block, which is fine.

## Optional tweak

If #BECEC5 reads too dull for the block over the background, set the block fill to `#fff`: background → #CDD6D0, white text → ~#0F0800.

## Verification

- `npm run build` in `personal-web-app/`.
- In the browser: body text, headings, nav and footer links turn dark under the block; links/buttons stay clickable (`pointer-events: none`); the toggle button still turns the block off; the pixel transition still covers the block.
