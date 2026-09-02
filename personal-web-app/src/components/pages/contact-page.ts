import { LitElement, css, html } from 'lit'

const ContactPageStyles = css`
  :host {
    display: block;
  }

  h1 {
    font-family: 'VT323', system-ui, sans-serif;
  }
`

export class ContactPage extends LitElement {
  static styles = [ContactPageStyles]

  render() {
    return html`<h1>Contact</h1>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'contact-page': ContactPage
  }
}

customElements.define('contact-page', ContactPage)
