import { LitElement, css, html } from 'lit'
import { AtomsStyles } from '../atoms.css.ts'
import PageStyles from '../page.css.ts'

const HomePageStyles = css`
  .links {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    list-style: none;
    padding: 0;
  }

  .home-page {
    padding: 2rem 0;
  }
    
  @media (max-width: 600px) {
    .home-page {
      padding: 15vw 0;
    }

    .links {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
`

// BELOW, handle loading... quick transition with skeletons if needed
// big loader on page components while load all heavy resources. make a util


export class HomePage extends LitElement {
  static styles = [PageStyles, HomePageStyles, AtomsStyles]

  render() {
    return html`
      <div class="page home-page">
        <h1>Ethan Bellora's Website</h1>
        <p>I'm a software engineer based in Atlanta, GA. I love solving complex problems on the web.</p>
        <p> learn more <a href="/about">about</a> me.
        <ul class="links">
          <li><a href="https://github.com/Ethanb75" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          <li><a href="https://www.linkedin.com/in/ethan-bellora-610a58132/" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
        </ul>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-page': HomePage
  }
}

customElements.define('home-page', HomePage)
