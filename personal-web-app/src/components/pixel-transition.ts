import { state } from '@lit/reactive-element/decorators/state.js';
import { LitElement, css, html } from 'lit';
import gsap from 'gsap';

const PixelTransitionStyles = css`
  :host {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    z-index: 1000;
    display: block;
    pointer-events: none;
  }

  .grid {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: repeat(var(--pixel-cols), 1fr);
    grid-template-rows: repeat(var(--pixel-rows), 1fr);
    border: none;
  }

  .pixel {
    background: var(--color-main-text);
    transform: scale(0);
    transform-origin: center;
  }
`;

// Slightly overscale covered pixels so they overlap neighboring cells,
// hiding the subpixel seams that appear when 1fr grid tracks round unevenly.
const COVERED_SCALE = 1.05;

const DESKTOP_COLUMNS = 14;
const DESKTOP_ROWS = 10;
const MOBILE_COLUMNS = 8;
const MOBILE_ROWS = 14;
const MOBILE_BREAKPOINT = '(max-width: 600px)';

export class PixelTransition extends LitElement {
  static styles = [PixelTransitionStyles];

  @state()
  private columns = DESKTOP_COLUMNS;

  @state()
  private rows = DESKTOP_ROWS;

  private mediaQuery = window.matchMedia(MOBILE_BREAKPOINT);

  private updateGridSize = () => {
    if (this.mediaQuery.matches) {
      this.columns = MOBILE_COLUMNS;
      this.rows = MOBILE_ROWS;
    } else {
      this.columns = DESKTOP_COLUMNS;
      this.rows = DESKTOP_ROWS;
    }
  };

  private get reducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  connectedCallback() {
    super.connectedCallback();
    this.updateGridSize();
    this.mediaQuery.addEventListener('change', this.updateGridSize);
  }

  disconnectedCallback() {
    this.mediaQuery.removeEventListener('change', this.updateGridSize);
    super.disconnectedCallback();
  }

  private get pixels(): NodeListOf<HTMLDivElement> {
    return this.shadowRoot!.querySelectorAll('.pixel');
  }

  async cover(): Promise<void> {
    if (this.reducedMotion) return;

    await this.updateComplete;

    gsap.killTweensOf(this.pixels);

    await gsap.to(this.pixels, {
      scale: COVERED_SCALE,
      duration: 0.5,
      ease: 'power1.inOut',
      stagger: {
        grid: [this.rows, this.columns],
        from: 'start',
        amount: 0.4,
      },
    });
  }

  async reveal(): Promise<void> {
    if (this.reducedMotion) return;

    await this.updateComplete;

    gsap.killTweensOf(this.pixels);

    await gsap.to(this.pixels, {
      scale: 0,
      duration: 0.5,
      ease: 'power1.inOut',
      stagger: {
        grid: [this.rows, this.columns],
        from: 'end',
        amount: 0.4,
      },
    });
  }

  render() {
    const cellCount = this.columns * this.rows;
    return html`
      <div
        class="grid"
        style="--pixel-cols: ${this.columns}; --pixel-rows: ${this.rows};"
      >
        ${Array.from({ length: cellCount }).map(() => html`<div class="pixel"></div>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pixel-transition': PixelTransition;
  }
}

customElements.define('pixel-transition', PixelTransition);
