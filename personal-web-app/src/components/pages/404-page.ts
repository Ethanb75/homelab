import { LitElement, css, html } from 'lit'
import { AtomsStyles } from '../atoms.css.ts'
import PageStyles from '../page.css.ts'

const FourOhFourPageStyles = css`
  .404-page {
    padding: 2rem 0;
  }

  @media (max-width: 600px) {
    .404-page {
      padding: 15vw 0;
    }
  }
`

export class FourOhFourPage extends LitElement {
  static styles = [PageStyles, FourOhFourPageStyles, AtomsStyles]

  render() {
    return html`
      <div class="page about-page">
        <h1>404</h1>
        <p>bad route</p>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'four-oh-four-page': FourOhFourPage
  }
}

customElements.define('four-oh-four-page', FourOhFourPage)
