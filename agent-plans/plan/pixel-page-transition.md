I looked through the current `personal-web-app`, and the transition fits your architecture particularly well because you already have lightweight client-side routing built around Lit, `history.pushState()`, and `currentPage`. We **do not need to add React, React Router, or a larger routing library**. Your entry point renders one `<app-main>`, and `Main` selects the page component from `window.location.pathname`. 

The Codrops project is also intentionally fairly simple: it uses JavaScript/GSAP and grids of elements with different row/column counts and stagger timings to produce the pixel effects. The repo is MIT licensed. ([GitHub][1])

## Target architecture

I would aim for this:

```text
personal-web-app/
└── src/
    ├── global.css
    └── components/
        ├── main.ts
        ├── link.ts
        ├── pixel-transition.ts      <-- new
        ├── background-svg.ts
        └── pages/
            ├── home-page.ts
            ├── about-page.ts
            ├── contact-page.ts
            └── 404-page.ts
```

And the navigation lifecycle becomes:

```text
User clicks About
        │
        ▼
<app-link>
dispatches "app-navigate"
        │
        ▼
<app-main>
        │
        ▼
pixel-transition.cover()
        │
        ▼
████████████████
████ viewport ███
████ covered ████
████████████████
        │
        ▼
history.pushState("/about")
currentPage = "/about"
Lit renders <about-page>
scroll to top
        │
        ▼
pixel-transition.reveal()
        │
        ▼
About page visible
```

That's the core design I recommend.

## Phase 1 — Add GSAP

Your current runtime dependency list contains only Lit. 

Add:

```bash
npm install gsap
```

I would **not** pull the entire Codrops project into your repo.

Instead, port the specific grid idea into a Lit component. Their repository is an experimental collection of variations; your site only needs the underlying mechanism. ([GitHub][1])

---

## Phase 2 — Build `<pixel-transition>`

Create:

```text
src/components/pixel-transition.ts
```

This should be a normal `LitElement` just like your existing components.

Conceptually:

```ts
export class PixelTransition extends LitElement {
  async cover() {
    // animate cells 0 → 1
  }

  async reveal() {
    // animate cells 1 → 0
  }

  render() {
    return html`
      <div class="grid">
        ${cells.map(() => html`
          <div class="pixel"></div>
        `)}
      </div>
    `;
  }
}
```

Its shadow DOM would contain something like:

```text
<pixel-transition>
  #shadow-root
    .grid
      .pixel
      .pixel
      .pixel
      .pixel
      ...
</pixel-transition>
```

CSS:

```text
position: fixed
inset: 0
width: 100vw
height: 100dvh
z-index: high
display: grid
pointer-events: none
```

Your existing animated `<background-svg>` is also fixed, but deliberately sits at `z-index: -1000`, so the pixel overlay can cleanly live above the application without interfering with it. 

### Initial visual configuration

I'd start with something around:

```text
Desktop:
12–16 columns
8–12 rows

Mobile:
8 columns
12–16 rows
```

Then tune it visually.

For your current color palette:

```css
--color-background: #32292f;
--color-main-text: #F0F7F4;
--color-primary: #99E1D9;
```

I'd try the pixels using:

```css
background: var(--color-primary);
```

first.

Your VT323 typography + animated block background + mint color already have a mildly retro/computer aesthetic, so the pixel transition should feel pretty natural rather than bolted on. Those colors and typography are already defined globally. 

---

## Phase 3 — Change `app-link` into a navigation request

This is the most important architectural change.

Right now `AppLink.handleClick()` does this directly:

```ts
event.preventDefault();
history.pushState({}, '', this.href);
```

and you've patched `pushState`, `replaceState`, and `popstate` to fire `app-location-change`. 

That means navigation currently happens immediately.

For transitions, **the route must not render until the pixels completely cover the old page.**

I'd change `app-link` so it requests navigation instead:

```ts
private handleClick(event: Event) {
  event.preventDefault();

  this.dispatchEvent(
    new CustomEvent('app-navigate', {
      detail: {
        href: this.href,
      },
      bubbles: true,
      composed: true,
    }),
  );
}
```

`composed: true` matters because you're using Shadow DOM; this lets the event escape `<app-link>` and reach `<app-main>`.

So `app-link` becomes intentionally dumb:

```text
"I want to navigate to /about."
```

rather than:

```text
"I will change the route myself."
```

That's a healthier separation even without the animation.

---

## Phase 4 — Make `Main` the navigation coordinator

Your `Main` component is already effectively your router:

```ts
private renderPage() {
  switch (this.currentPage) {
    case '/about':
      return html`<about-page></about-page>`

    case '/contact':
      return html`<contact-page></contact-page>`

    case '/':
      return html`<home-page></home-page>`

    default:
      return html`<four-oh-four-page></four-oh-four-page>`
  }
}
```



That's where transition orchestration belongs.

Add:

```html
<pixel-transition></pixel-transition>
```

roughly alongside:

```html
<background-svg></background-svg>
```

Then give `Main` one method along these lines:

```ts
private async navigate(path: string) {
  if (path === this.currentPage) {
    return;
  }

  const transition =
    this.shadowRoot?.querySelector<PixelTransition>(
      'pixel-transition'
    );

  await transition?.cover();

  history.pushState({}, '', path);

  this.currentPage = path;

  await this.updateComplete;

  window.scrollTo(0, 0);

  await transition?.reveal();
}
```

That gives us a very clean transition boundary.

---

## Phase 5 — Treat it as a tiny state machine

I would explicitly prevent double navigation.

Something like:

```text
idle
 ↓
covering
 ↓
covered
 ↓
changing-page
 ↓
revealing
 ↓
idle
```

At minimum:

```ts
private isTransitioning = false;
```

Then:

```ts
if (this.isTransitioning) return;

this.isTransitioning = true;

try {
  ...
} finally {
  this.isTransitioning = false;
}
```

This protects you from:

```text
Home
click About
click Contact
click Home
click About
```

during the 500–800ms animation and ending up with overlapping GSAP timelines.

---

## Phase 6 — Keep `app-location-change`, but simplify it

There's no real need for the global history monkey-patching once `Main` owns navigation.

I'd eventually remove this part of `link.ts`:

```ts
const originalPushState = history.pushState.bind(history);

history.pushState = (...) => {
   ...
}
```



Instead, have `Main` emit:

```ts
window.dispatchEvent(
  new Event('app-location-change')
);
```

**after the route actually changes.**

That means your existing `app-link` active-state logic can stay:

```ts
private updateActive = () => {
  this.active =
    window.location.pathname === this.href;
};
```

You get to preserve that behavior while removing the unusual global `history.pushState` override.

---

## Phase 7 — Handle browser Back/Forward correctly

This deserves its own implementation step.

Right now:

```text
Back button
     ↓
popstate
     ↓
currentPage changes
```

For the new behavior we want:

```text
Back button
     ↓
popstate says URL is now /about
     ↓
KEEP CURRENT PAGE RENDERED
     ↓
pixel cover
     ↓
currentPage = /about
     ↓
render
     ↓
pixel reveal
```

The browser URL will already have changed because that's how `popstate` works, but your **rendered `currentPage` doesn't have to change yet**.

So I'd have:

```ts
window.addEventListener('popstate', () => {
  this.transitionTo(
    window.location.pathname,
    false
  );
});
```

The `false` means:

```text
don't call pushState again
```

Giving us one API:

```ts
transitionTo(path, updateHistory)
```

where normal links do:

```ts
transitionTo('/about', true)
```

and browser history does:

```ts
transitionTo('/about', false)
```

---

## Phase 8 — Match the specific Codrops animation

Once routing works correctly, **then** tune the visual animation.

Don't try to perfect the GSAP animation before the navigation lifecycle works.

I'd first implement:

```text
scale: 0 → 1
random stagger
```

Then try a more deliberate sweep.

For your site, I think one of these would work especially well:

```text
           ┌─────→

░░░░░░░░░░
██░░░░░░░░
████░░░░░░
██████░░░░
████████░░
██████████
```

or:

```text
random/dithered

░░█░░░█░░░
█░░░█░░░█░
░██░░██░░░
████░██░██
██████████
```

The Codrops article specifically explores changing grid dimensions and individual cell timing to create the different looks, so we can freely tune this after the architecture is in place. ([Codrops][2])

I'd probably start with a **directional + slightly randomized stagger**, rather than completely random pixels.

That would fit your site's structured terminal-like styling.

---

## Phase 9 — Add content animation only after the pixels work

Codrops combines the grid transition with content motion in some variations. ([Codrops][2])

For version 1, don't.

Use only:

```text
page
 ↓
pixels cover
 ↓
swap page
 ↓
pixels reveal
```

Later we can add:

```text
old content:
opacity 1 → 0
translateY(0 → -15px)

pixels:
cover

new content:
translateY(15px → 0)
opacity 0 → 1

pixels:
reveal
```

That should be a second pass.

---

## Phase 10 — Respect reduced motion

Add:

```css
@media (prefers-reduced-motion: reduce) {
  ...
}
```

And in TypeScript:

```ts
window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches
```

If enabled:

```text
skip GSAP
change route immediately
```

This prevents the effect from making the site harder to use for visitors who explicitly disable motion.

---

## Implementation order

I would make the changes in this order:

1. **Install `gsap`.**
2. **Create `pixel-transition.ts`.**
3. Give it simple `cover()` / `reveal()` methods.
4. Render `<pixel-transition>` once inside `Main`.
5. Change `<app-link>` from directly calling `pushState()` to dispatching `app-navigate`.
6. Have `Main` listen for `app-navigate`.
7. Cover pixels.
8. Change history + `currentPage`.
9. Wait for `this.updateComplete`.
10. Reveal pixels.
11. Rework `popstate` for Back/Forward transitions.
12. Remove the existing history monkey-patching.
13. Add navigation locking.
14. Add reduced-motion handling.
15. Tune grid dimensions, stagger, duration, and colors.
16. Test `/`, `/about`, `/contact`, 404, Back, Forward, refresh, mobile, and rapid clicks.

### The finished responsibility split

```text
app-link.ts
    │
    │ intent
    ▼
"navigate to /about"
    │
    ▼
main.ts
    │
    ├──── pixel-transition.cover()
    │
    ├──── history.pushState()
    │
    ├──── currentPage = "/about"
    │
    ├──── Lit render
    │
    └──── pixel-transition.reveal()


pixel-transition.ts
    │
    └──── knows nothing about routing
          knows only how to animate
```

That's the structure I'd use.

The nice part is that this actually makes your current routing **cleaner**, rather than just layering an animation hack over it. `Main` is already serving as your little router, so we can formalize that and give the pixel transition one well-defined job. 

I also surfaced the GitHub connector for you. If you connect it, we can work directly against the repository more easily on follow-up implementation tasks instead of relying on public GitHub reads.

[1]: https://github.com/codrops/PixelTransition/?utm_source=chatgpt.com "GitHub - codrops/PixelTransition: Ideas for pixel page transitions based on an animation by Niccolò Miranda. · GitHub"
[2]: https://tympanus.net/codrops/2023/04/05/ideas-for-pixel-page-transitions/?utm_source=chatgpt.com "Ideas for Pixel Page Transitions | Codrops"
