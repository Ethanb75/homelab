import { property } from '@lit/reactive-element/decorators/property.js';
import { LitElement, css, html, type PropertyValues } from 'lit';
import './background-svg'
import './pages/home-page'
import './pages/about-page'
import './pages/contact-page'
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
    window.addEventListener('popstate', () => {
      this.currentPage = window.location.pathname;
    });
  }

  protected firstUpdated(changedProperties: PropertyValues) {
    super.firstUpdated(changedProperties);

    //set the current page based on the current URL path
    this.shadowRoot?.querySelectorAll(`.navigation a.button-link[href="${this.currentPage}"]`)[0]?.classList.add('active');
  }

  private handleClick(event: Event): HTMLAnchorElement {
    event.preventDefault();
    const target = event.target as HTMLAnchorElement;
    const href = target.getAttribute('href');
    if (href) {
      window.history.pushState({}, '', href);
      this.currentPage = href;
    }

    return target;
  }

  private handleNavClick(event: Event) {
    const target = this.handleClick(event);

    // this is stupid
    const navLinks = this.shadowRoot?.querySelectorAll('.navigation a');
    navLinks?.forEach(link => link.classList.remove('active'));
    target.classList.add('active');
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
      default:
        return html`<home-page></home-page>`
    }
  }

  protected render() {
    return html`
      <background-svg></background-svg>
      <!-- navigation -->
      <nav class="navigation">
        <ul>
          <li><a class="button-link" href="/" @click=${this.handleNavClick}>Home</a></li>
          <li><a class="button-link" href="/about" @click=${this.handleNavClick}>About</a></li>
          <li><a class="button-link" href="/contact" @click=${this.handleNavClick}>Contact</a></li>
        </ul>
      </nav>
      <main class="main-content">
        ${this.renderPage()}
      </main>
      <footer class="footer">
        <!-- footer menu -->
        <div>
          <ul>
            <li><a class="button-link" href="/" @click=${this.handleNavClick}>Home</a></li>
            <li><a class="button-link" href="/about" @click=${this.handleClick}>About</a></li>
            <li><a class="button-link" href="/contact" @click=${this.handleClick}>Contact</a></li>
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
