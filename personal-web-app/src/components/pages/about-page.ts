import { LitElement, css, html } from 'lit'

const AboutPageStyles = css`
  :host {
    display: block;
  }

  h1 {
    font-family: 'VT323', system-ui, sans-serif;
  }
`

export class AboutPage extends LitElement {
  static styles = [AboutPageStyles]

  render() {
    return html`<h1>About</h1>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'about-page': AboutPage
  }
}

customElements.define('about-page', AboutPage)
