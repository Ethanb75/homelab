import { LitElement, css, html } from 'lit'

const HomePageStyles = css`
  :host {
    display: block;
  }
`

// BELOW, handle loading... how can we make it seem instant

export class HomePage extends LitElement {
  static styles = [HomePageStyles]

  render() {
    return html`<h1>Ethan Bellora's Website</h1>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-page': HomePage
  }
}

customElements.define('home-page', HomePage)
