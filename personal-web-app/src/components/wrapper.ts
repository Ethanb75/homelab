import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'

const WrapperStyles = css`
  :host {
    display: block;
  }
`

/**
 * keep these on every page, but make them optional to show/hide
 * 
 * @slot - This element has a slot
 */
@customElement('wrapper')
export class Wrapper extends LitElement {
  static styles = [WrapperStyles]

  render() {
    return html`
      <div>
        <header>
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </nav>
        </header>
        <main>
          <slot></slot>
        </main>
        <footer>
          <p>Footer content goes here</p>
        </footer>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wrapper': Wrapper
  }
}
