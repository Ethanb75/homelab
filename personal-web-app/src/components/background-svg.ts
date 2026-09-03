import { LitElement, css, html } from 'lit'

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

  private blockDrop = () => {
    const svg = this.shadowRoot?.getElementById('background-svg');
    const moveBlock = this.shadowRoot?.querySelector('#block1') as SVGRectElement | null;

    if (svg && moveBlock) {
      const svgClasses = ['move-down-y', 'move-up-y', 'move-left-x', 'move-right-x'];

      setInterval(() => {
        // random 0-3
        const randomNum = Math.floor(Math.random() * 3);
        const svgClassThisRound = svgClasses.filter((a) => a !== moveBlock.getAttribute('class'))[randomNum];
        moveBlock.removeAttribute('class');
        moveBlock.setAttribute('class', svgClassThisRound);

        // x-axis moves get a random y, y-axis moves get a random x
        const axis = svgClassThisRound.endsWith('-x') ? 'y' : 'x';
        const randomPosition = Math.floor(Math.random() * 100);
        moveBlock.setAttribute(axis, `${randomPosition}`);
        // const newNode = moveBlock.cloneNode(true) as SVGRectElement;
        // svg.appendChild(newNode);

      }, 3000);
    }
  }

  // lifecycle method called when the component is first updated
  firstUpdated() {
    this.blockDrop();
  }

  render() {
    return html`
      <svg id="background-svg" class="background" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="100" fill="black" />
        <!-- copy me -->
         <!-- 12 rects -->
          <!-- when they animate, add them to queue, when they're done, remove them -->
           <!-- every interval, try to animate but check if rect is in the queue -->
        <rect id="block1" class="move-up-y" width="10" height="10" fill="white"/>
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
