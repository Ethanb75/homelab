import { property } from '@lit/reactive-element/decorators/property.js';
import { LitElement, css, html } from 'lit';
import './pages/home-page'
import './pages/about-page'
import './pages/contact-page'


const MainStyles = css`
  :host {
    width: 85vw;
    display: flex;
    flex-direction: column;
  }

  .navigation {
    margin: 2rem 0;
  }
  
  .navigation ul {
    margin: 0;
    padding: 0;
    display: flex;
    gap: 1rem;
  }
  
  .navigation li {
    list-style: none;
  }
  .footer {
  
  }
`;

export class Main extends LitElement {
  @property({ type: String })
  public currentPage: string = window.location.pathname;
  static styles = [MainStyles];

  private handleClick(event: Event) {
    event.preventDefault();
    const target = event.target as HTMLAnchorElement;
    const href = target.getAttribute('href');
    if (href) {
      window.history.pushState({}, '', href);
      this.currentPage = href;
    }
  }

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

  render() {
    return html`
    <!-- navigation -->
      <nav class="navigation">
        <ul>
          <li><a href="/" @click=${this.handleClick}>Home</a></li>
          <li><a href="/about" @click=${this.handleClick}>About</a></li>
          <li><a href="/contact" @click=${this.handleClick}>Contact</a></li>
        </ul>
      </nav>
      ${this.renderPage()}
      <footer class="footer">
        <!-- footer menu -->
        <div>
          <ul>
            <li><a href="/" @click=${this.handleClick}>Home</a></li>
            <li><a href="/about" @click=${this.handleClick}>About</a></li>
            <li><a href="/contact" @click=${this.handleClick}>Contact</a></li>
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
