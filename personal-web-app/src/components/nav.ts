import { property } from '@lit/reactive-element/decorators/property.js';
import { LitElement, css, html } from 'lit';


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

  render() {
    return html`
      <ul>
        <li><a href="/" @click=${this.handleClick}>Home</a></li>
        <li><a href="/about" @click=${this.handleClick}>About</a></li>
        <li><a href="/contact" @click=${this.handleClick}>Contact</a></li>
      </ul>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-nav': Nav
  }
}

customElements.define('app-nav', Nav);
