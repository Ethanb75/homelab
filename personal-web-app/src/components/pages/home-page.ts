import { LitElement, css, html } from 'lit'

const HomePageStyles = css`
  :host {
    display: block;
  }

  h1 {
    font-family: 'VT323', system-ui, sans-serif;
  }
`

// BELOW, handle loading... quick transition with skeletons if needed
// big loader on page components while load all heavy resources. make a util


export class HomePage extends LitElement {
  static styles = [HomePageStyles]

  render() {
    return html`
    <main>
      <h1>Ethan Bellora's Website</h1>
      <p>Welcome to my personal website! This is the home page.</p>
    </main>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-page': HomePage
  }
}

customElements.define('home-page', HomePage)
