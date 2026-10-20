# Plan: toggle for the scrolling background block

**Deliverable of this session:** save this plan as `agent-plans/plan/background-block-toggle.md` (same folder as `pixel-page-transition.md`, `gov-chat.md`, etc.). No app code is changed until the plan is executed.

## Context

The personal web app (`personal-web-app/`, Lit + Vite) renders `<background-svg>` behind every page. It holds one white rect (`#block1`, `fill="var(--color-main-text)"`) that a `setInterval` in `blockDrop()` sends across the screen every 3s in a random direction. Some visitors will find the motion distracting, so we want a button that turns it off. The block stays **on by default**. The choice is **saved in localStorage**, and the button sits **fixed in the bottom-right corner** of every page.

## Current code

- `src/components/background-svg.ts`: `BackgroundSvg`. `firstUpdated()` calls `blockDrop()`, which starts a `setInterval` that is never cleared. It swaps the `move-*` animation class on `#block1` and randomizes its x/y.
- `src/components/main.ts`: `Main` renders `<background-svg>`, `<pixel-transition>` (z-index 1000, so it must keep covering the button during page transitions), the nav, `<main>` and the footer. It already uses `@property` from `@lit/reactive-element/decorators/property.js`.
- `src/components/pages/gov-chat-page.ts:224`: the existing button styling (primary fill, `font: inherit`, transparent outlined `.reset` variant). The new button reuses this look.
- `src/global.css`: color tokens `--color-background`, `--color-main-text`, `--color-primary`.

## Changes

### 1. `background-svg.ts`: make the animation switchable

- Add a reflected boolean property: `@property({ type: Boolean, reflect: true }) animated = true`, using the same decorator import path as `main.ts`.
- Keep the interval id: `private intervalId?: number`.
- Split `blockDrop()` into `startBlock()` and `stopBlock()`:
  - `startBlock()`: if an interval is already running, return. Otherwise run the existing setInterval body and store its id.
  - `stopBlock()`: `clearInterval(this.intervalId)` and reset the id to undefined.
- Replace `firstUpdated()` with `updated(changed)`: when `changed.has('animated')`, call `startBlock()` if `this.animated` is true, otherwise `stopBlock()`. This covers the first render too.
- In `render()`, add the block only when it is on: `${this.animated ? svg`<rect id="block1" …>` : nothing}` (import `svg` and `nothing` from `lit`). Removing the rect also stops any CSS animation that is mid-flight. Because `startBlock()` queries `#block1` inside `updated()`, the rect already exists when it runs.
- Add `disconnectedCallback()` that calls `stopBlock()` and then `super.disconnectedCallback()`. This fixes the interval leak.

### 2. `main.ts`: own the state and render the button

- Add the state, read from storage with the default set to on:
  ```ts
  @state() private blockEnabled = readBlockPref();
  ```
  where a small module-level helper does:
  ```ts
  const BLOCK_PREF_KEY = 'bg-block-enabled';
  const readBlockPref = () => {
    try { return localStorage.getItem(BLOCK_PREF_KEY) !== 'false'; } catch { return true; }
  };
  ```
  Only an explicit `'false'` turns it off, so first-time visitors and blocked storage both get the block. Import `state` from `@lit/reactive-element/decorators/state.js`, matching how `property` is imported in this file.
- `private toggleBlock = () => { this.blockEnabled = !this.blockEnabled; try { localStorage.setItem(BLOCK_PREF_KEY, String(this.blockEnabled)); } catch {} }`
- Render: `<background-svg ?animated=${this.blockEnabled}></background-svg>`
- Add the button after the footer:
  ```html
  <button type="button" class="block-toggle"
    aria-pressed=${this.blockEnabled}
    @click=${this.toggleBlock}>
    ${this.blockEnabled ? 'block: on' : 'block: off'}
  </button>
  ```
  (Lowercase terminal-style labels to match the VT323 look. Final wording is up to you.)
- Add to `MainStyles`:
  ```css
  .block-toggle {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 10;            /* above content, below pixel-transition (1000) */
    font: inherit;
    font-size: 1.2rem;
    color: var(--color-primary);
    background: var(--color-background);
    border: 1px solid var(--color-primary);
    padding: 0.25rem 1rem;
    cursor: pointer;
  }
  .block-toggle[aria-pressed="true"] {
    color: var(--color-background);
    background: var(--color-primary);
  }
  .block-toggle:focus-visible { outline: 2px solid var(--color-main-text); outline-offset: 2px; }
  ```
  This mirrors the filled and outlined button styles in `gov-chat-page.ts`.

### Out of scope (possible follow-ups)

- Defaulting to off when `prefers-reduced-motion: reduce` is set. The current request is "on by default", so this plan doesn't do it.
- The "12 rects / queue" idea in the `background-svg.ts` comments.

## Verification

1. `cd personal-web-app && npx tsc --noEmit` (or `npm run build`) passes.
2. `npm run dev`, then open the site:
   - First load with no localStorage key: the block animates and the button shows "block: on" (filled).
   - Click the button: the block disappears right away, the label changes to "block: off" (outlined), and `localStorage['bg-block-enabled'] === 'false'`.
   - Reload: the block stays off. Click again: the block comes back and resumes moving every 3s, with no double-speed moves (which would mean two intervals are running).
   - Navigate between pages: the pixel transition covers the button, and the button and state persist across routes.
   - At phone width (~375px) the button doesn't cover the footer links in a way that breaks them. If it does, add bottom padding to `.footer`.
3. Don't start Docker or the compose stack locally to check this. The Vite dev server is enough.
