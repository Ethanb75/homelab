# Randomize scrolling block animation speed

## Context
The scrolling white block in the personal web app (`personal-web-app/src/components/background-svg.ts`) always crosses the screen in exactly 3s. Every pass looks the same. The goal is to give each pass a random duration between 2s and 6s, so some passes are quick and others slow.

## Current behavior
- All four animation classes (`.move-down-y`, `.move-up-y`, `.move-left-x`, `.move-right-x`) hard-code `animation: <name> 3s linear forwards` (lines 31, 48, 65, 82).
- `moveBlock()` (line 106) picks a new class and a random cross-axis position. The class always changes (the current one is filtered out), so the animation restarts.
- The first pass comes from the `move-up-y` class written in `render()` (line 166). `updated()` (line 144) handles only the `animated → false` case.

## Approach
Leave the CSS as it is. 3s stays the fallback default. Override `animation-duration` with an inline style on the rect before each pass starts.

1. **Add a duration helper** near `onBlockAnimationEnd`:
   ```ts
   // random 2-6s per pass
   private randomDuration = () => `${2 + Math.random() * 4}s`;
   ```

2. **Apply it in `moveBlock()`.** Set `moveBlock.style.animationDuration = this.randomDuration();` before the class is swapped, so the restarted animation uses the new duration.

3. **Randomize the first pass too.** In `updated()`, when `animated` changes to `true` (this also fires on the initial render), look up `#block1` and set its `style.animationDuration`. Do this in `updated()` rather than as a `style=` binding in `render()`. Otherwise Lit's template binding and the imperative writes in `moveBlock()` would both control the same attribute.
   ```ts
   updated(changed: PropertyValues<this>) {
     if (!changed.has('animated')) return;
     if (this.animated) {
       const block = this.shadowRoot?.querySelector('#block1') as SVGRectElement | null;
       if (block) block.style.animationDuration = this.randomDuration();
     } else {
       this.stopBlock();
     }
   }
   ```
   Also update the comment above `updated()`, because starting the animation now does a small amount of work.

The keyframes use percentage stops (the 70% stop scales with duration), and the 1–7s gap between passes set in `onBlockAnimationEnd` stays the same.

## Files
- `personal-web-app/src/components/background-svg.ts` is the only source file that changes.
- Copy this plan to `agent-plans/plan/background-block-speed-variation.md` before implementing.

## Verification
- Run `npm run build` in `personal-web-app` and confirm it passes.
- Run the dev server and watch several passes: speeds should visibly differ. In DevTools, `#block1` should show a different inline `animation-duration` (between 2s and 6s) after each pass.
- Turn the block off and back on with the toggle button. The block should reappear with a random duration and keep cycling.
