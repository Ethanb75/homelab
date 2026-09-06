import { property } from '@lit/reactive-element/decorators/property.js';
import { LitElement, css, html, type PropertyValues } from 'lit';
import './background-svg'
import './link'
import './pages/home-page'
import './pages/about-page'
import './pages/contact-page'
import './pages/404-page.ts'
import { AtomsStyles } from './atoms.css.ts'


const MainStyles = css`
  :host {
    display: flex;
    flex-direction: column;
  }
  .navigation {
    width: 75vw;
    margin: 2rem 0;
  }
  
  .navigation ul, .footer ul {
    margin: 0;
    padding: 0;
    display: flex;
    gap: 0.5rem;
    left: -1rem;
    position: relative;
  }
  
  .navigation li, .footer li {
    list-style: none;
  }

  .main-content {
    flex-grow: 1;

  }

  .footer {

  }
`;

export class Main extends LitElement {
  @property({ type: String })
  public currentPage: string = window.location.pathname;
  static styles = [MainStyles, AtomsStyles];

  constructor() {
    super();
    window.addEventListener('app-location-change', () => {
      this.currentPage = window.location.pathname;
    });
  }

  protected update(changedProperties: PropertyValues) {
    super.update(changedProperties);
    console.log('changed!', changedProperties);
  }

  

  // faster with just html and no web components?
  private renderPage() {
    switch (this.currentPage) {
      case '/about':
        return html`<about-page></about-page>`
      case '/contact':
        return html`<contact-page></contact-page>`
      case '/':
        return html`<home-page></home-page>`
      default:
        return html`<four-oh-four-page></four-oh-four-page>`
    }
  }

  protected render() {
    return html`
      <background-svg></background-svg>
      <!-- navigation -->
      <nav class="navigation">
        <ul>
          <li><app-link href="/" nav>Home</app-link></li>
          <li><app-link href="/about" nav>About</app-link></li>
          <li><app-link href="/contact" nav>Contact</app-link></li>
        </ul>
      </nav>
      <main class="main-content">
        ${this.renderPage()}
      </main>
      <footer class="footer">
        <!-- footer menu -->
        <div>
          <ul>
            <li><app-link href="/">Home</app-link></li>
            <li><app-link href="/about">About</app-link></li>
            <li><app-link href="/contact">Contact</app-link></li>
          </ul>
        </div>
        <p>copyright &copy; 2026 Ethan Bellora</p>
      </footer>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-main': Main
  }
}

customElements.define('app-main', Main);
