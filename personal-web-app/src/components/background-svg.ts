import { property } from '@lit/reactive-element/decorators/property.js'
import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit'

const BackgroundSvgStyles = css`
  :host {
    display: block;
  }

  .background {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1000;
    pointer-events: none;
  }

  /* sits above the page content; difference blending turns white text black where the block covers it */
  .block-layer {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 5;
    pointer-events: none;
    mix-blend-mode: difference;
  }

  .move-down-y {
    y: -10%;
    animation: move-down 3s linear forwards;
  }

  @keyframes move-down {
    0% {
      transform: translateY(-10%);
    }
    70% {
      transform: translateY(85%);
    }
    100% {
      transform: translateY(110%);
    }
  }

  .move-up-y {
    y: -10%;
    animation: move-up 3s linear forwards;
  }

  @keyframes move-up {
    0% {
      transform: translateY(110%);
    }
    70% {
      transform: translateY(10%);
    }
    100% {
      transform: translateY(-10%);
    }
  }

  .move-left-x {
    x: -10%;
    animation: move-left 3s linear forwards;
  }

  @keyframes move-left {
    0% {
      transform: translateX(110%);
    }
    70% {
      transform: translateX(10%);
    }
    100% {
      transform: translateX(-10%);
    }
  }

  .move-right-x {
    x: -10%;
    animation: move-right 3s linear forwards;
  }

  @keyframes move-right {
    0% {
      transform: translateX(-10%);
    }
    70% {
      transform: translateX(85%);
    }
    100% {
      transform: translateX(110%);
    }
  }
`

export class BackgroundSvg extends LitElement {
  static styles = [BackgroundSvgStyles]

  @property({ type: Boolean, reflect: true })
  public animated = true;

  private timeoutId?: number;

  private moveBlock = () => {
    this.timeoutId = undefined;

    const moveBlock = this.shadowRoot?.querySelector('#block1') as SVGRectElement | null;
    if (!moveBlock || !this.animated) {
      return;
    }

    const svgClasses = ['move-down-y', 'move-up-y', 'move-left-x', 'move-right-x'];

    // random 0-2
    const randomNum = Math.floor(Math.random() * 3);
    const svgClassThisRound = svgClasses.filter((a) => a !== moveBlock.getAttribute('class'))[randomNum];
    moveBlock.style.animationDuration = this.randomDuration();
    moveBlock.removeAttribute('class');
    moveBlock.setAttribute('class', svgClassThisRound);

    // x-axis moves get a random y, y-axis moves get a random x
    const axis = svgClassThisRound.endsWith('-x') ? 'y' : 'x';
    const randomPosition = Math.floor(Math.random() * 100);
    moveBlock.setAttribute(axis, `${randomPosition}`);
  }

  // random 2-6s per pass
  private randomDuration = () => `${2 + Math.random() * 4}s`;

  // wait 1-7s after each animation finishes before starting the next one
  private onBlockAnimationEnd = () => {
    if (!this.animated) {
      return;
    }

    const delay = 1000 + Math.random() * 6000;
    this.timeoutId = window.setTimeout(this.moveBlock, delay);
  }

  private stopBlock = () => {
    clearTimeout(this.timeoutId);
    this.timeoutId = undefined;
  }

  // the rect renders with an initial animation class, so starting only needs a random duration
  updated(changed: PropertyValues<this>) {
    if (!changed.has('animated')) {
      return;
    }

    if (this.animated) {
      const block = this.shadowRoot?.querySelector('#block1') as SVGRectElement | null;
      if (block) {
        block.style.animationDuration = this.randomDuration();
      }
    } else {
      this.stopBlock();
    }
  }

  disconnectedCallback() {
    this.stopBlock();
    super.disconnectedCallback();
  }

  render() {
    return html`
      <svg id="background-svg" class="background" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="100" fill="var(--color-background)" />
      </svg>
      <svg class="block-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <!-- copy me -->
         <!-- 12 rects -->
          <!-- when they animate, add them to queue, when they're done, remove them -->
           <!-- every interval, try to animate but check if rect is in the queue -->
        ${this.animated
          ? svg`<rect id="block1" class="move-up-y" width="10" height="10" fill="var(--color-main-text)" @animationend=${this.onBlockAnimationEnd}/>`
          : nothing}
      </svg>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'background-svg': BackgroundSvg
  }
}

customElements.define('background-svg', BackgroundSvg)
