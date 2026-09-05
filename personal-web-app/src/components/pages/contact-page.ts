import { LitElement, css, html } from 'lit'
import { AtomsStyles } from '../atoms.css.ts'
import PageStyles from '../page.css.ts'

const ContactPageStyles = css`
  .contact-page {
    padding: 2rem 0;
  }

  .contact-list {
    margin: 0;
  }

  .contact-list dt {
    font-weight: bold;
  }

  .contact-list dd {
    margin: 0 0 1rem 0;
  }

  @media (max-width: 600px) {
    .contact-page {
      padding: 15vw 0;
    }
  }
`

export class ContactPage extends LitElement {
  static styles = [PageStyles, ContactPageStyles, AtomsStyles]

  render() {
    return html`
      <div class="page contact-page">
        <h1>Contact</h1>
        <p>Please feel free to reach out</p>
        <dl class="contact-list">
          <dt>Email</dt>
          <dd><a href="mailto:belloramail@gmail.com">belloramail@gmail.com</a></dd>
          <dt>GitHub</dt>
          <dd><a href="https://github.com/Ethanb75" target="_blank" rel="noopener noreferrer">Ethanb75</a></dd>
          <dt>LinkedIn</dt>
          <dd><a href="https://www.linkedin.com/in/ethan-bellora-610a58132/" target="_blank" rel="noopener noreferrer">ethan-bellora</a></dd>
        </dl>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'contact-page': ContactPage
  }
}

customElements.define('contact-page', ContactPage)
