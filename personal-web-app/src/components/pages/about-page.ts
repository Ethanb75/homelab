import { LitElement, css, html } from 'lit'
import { AtomsStyles } from '../atoms.css.ts'
import PageStyles from '../page.css.ts'

const AboutPageStyles = css`
  .about-page {
    padding: 2rem 0;
  }

  @media (max-width: 600px) {
    .about-page {
      padding: 15vw 0;
    }
  }
`

export class AboutPage extends LitElement {
  static styles = [PageStyles, AboutPageStyles, AtomsStyles]

  render() {
    return html`
      <div class="page about-page">
        <h1>About</h1>
        <p>WIP</p>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'about-page': AboutPage
  }
}

customElements.define('about-page', AboutPage)
