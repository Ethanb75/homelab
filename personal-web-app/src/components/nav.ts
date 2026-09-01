import { property } from '@lit/reactive-element/decorators/property.js';
import { LitElement, css, html } from 'lit';
import './home-page'
import './about-page'
import './contact-page'


const NavStyles = css`
  :host {
    display: block;
  }
`

export class Nav extends LitElement {
  @property({ type: String })
  public currentPage: string = window.location.pathname;
  static styles = [NavStyles];

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
      <ul>
        <li><a href="/" @click=${this.handleClick}>Home</a></li>
        <li><a href="/about" @click=${this.handleClick}>About</a></li>
        <li><a href="/contact" @click=${this.handleClick}>Contact</a></li>
      </ul>
      ${this.renderPage()}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-nav': Nav
  }
}

customElements.define('app-nav', Nav);
