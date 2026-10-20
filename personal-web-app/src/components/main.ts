import { property } from '@lit/reactive-element/decorators/property.js';
import { query } from '@lit/reactive-element/decorators/query.js';
import { state } from '@lit/reactive-element/decorators/state.js';
import { LitElement, css, html } from 'lit';
import './background-svg'
import './link'
import './pixel-transition'
import type { PixelTransition } from './pixel-transition'
import './pages/home-page'
import './pages/about-page'
import './pages/contact-page'
import './pages/gov-chat-page'
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

  .navigation ul {
    left: -1rem;
  }
  
  .navigation ul, .footer ul {
    margin: 0;
    padding: 0;
    display: flex;
    gap: 0.5rem;
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

  .block-toggle {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 10; /* above content, below pixel-transition (1000) */
    font: inherit;
    font-size: 1.2rem;
    color: var(--color-primary);
    background: var(--color-background);
    border: 1px solid var(--color-primary);
    padding: 0.25rem 1rem;
    cursor: pointer;
  }

  .block-toggle[aria-pressed="true"] {
    color: var(--color-background);
    background: var(--color-primary);
  }

  .block-toggle:focus-visible {
    outline: 2px solid var(--color-main-text);
    outline-offset: 2px;
  }
`;

// only an explicit 'false' turns the block off, so new visitors and blocked storage get it
const BLOCK_PREF_KEY = 'bg-block-enabled';
const readBlockPref = () => {
  try {
    return localStorage.getItem(BLOCK_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
};

export class Main extends LitElement {
  @property({ type: String })
  public currentPage: string = window.location.pathname;
  static styles = [MainStyles, AtomsStyles];

  @state()
  private blockEnabled = readBlockPref();

  @query('pixel-transition')
  private pixelTransition?: PixelTransition;

  private isTransitioning = false;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('app-navigate', this.handleNavigate);
    window.addEventListener('popstate', this.handlePopState);
  }

  disconnectedCallback() {
    window.removeEventListener('app-navigate', this.handleNavigate);
    window.removeEventListener('popstate', this.handlePopState);
    super.disconnectedCallback();
  }

  private handleNavigate = (event: Event) => {
    const { href } = (event as CustomEvent<{ href: string }>).detail;
    this.transitionTo(href, true);
  };

  private handlePopState = () => {
    this.transitionTo(window.location.pathname, false);
  };

  private toggleBlock = () => {
    this.blockEnabled = !this.blockEnabled;
    try {
      localStorage.setItem(BLOCK_PREF_KEY, String(this.blockEnabled));
    } catch {}
  };

  private async transitionTo(path: string, updateHistory: boolean) {
    if (path === this.currentPage || this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;

    try {
      await this.pixelTransition?.cover();

      if (updateHistory) {
        history.pushState({}, '', path);
      }

      this.currentPage = path;

      await this.updateComplete;

      window.scrollTo(0, 0);

      window.dispatchEvent(new Event('app-location-change'));

      await this.pixelTransition?.reveal();
    } finally {
      this.isTransitioning = false;
    }
  }

  // faster with just html and no web components?
  private renderPage() {
    switch (this.currentPage) {
      case '/about':
        return html`<about-page></about-page>`
      case '/contact':
        return html`<contact-page></contact-page>`
      case '/projects/gov-chat':
        return html`<gov-chat-page></gov-chat-page>`
      case '/':
        return html`<home-page></home-page>`
      default:
        return html`<four-oh-four-page></four-oh-four-page>`
    }
  }

  protected render() {
    return html`
      <background-svg ?animated=${this.blockEnabled}></background-svg>
      <pixel-transition></pixel-transition>
      <!-- navigation -->
      <nav class="navigation">
        <ul>
          <li><app-link href="/" nav>Home</app-link></li>
          <li><app-link href="/about" nav>About</app-link></li>
          <li><app-link href="/contact" nav>Contact</app-link></li>
          <li><app-link href="/projects/gov-chat" nav>Gov Chat</app-link></li>
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
            <li><app-link href="/projects/gov-chat">Gov Chat</app-link></li>
          </ul>
        </div>
        <p>copyright &copy; 2026 Ethan Bellora</p>
      </footer>
      <button type="button" class="block-toggle"
        aria-pressed=${this.blockEnabled}
        @click=${this.toggleBlock}>
        ${this.blockEnabled ? 'block: on' : 'block: off'}
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-main': Main
  }
}

customElements.define('app-main', Main);
