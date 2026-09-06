import { property } from '@lit/reactive-element/decorators/property.js';
import { LitElement, css, html } from 'lit';

const LinkStyles = css`
  a {
    color: #AF9085;
  }
  
  a.button-link.active {
    color: var(--color-primary);
  }

  a:visited {
    color: #AF9085;
  }

  a.button-link:hover {
    color: var(--color-primary);
    transition: color 0.3s ease;
  }

  :host([nav]) a.button-link {
    text-decoration: none;
    padding: 1rem;
  }

  :host([nav]) a.button-link::after {
    content: '';
    display: block;
    position: relative;
    top: .5rem;
    width: 0;
    height: 2px;
    background: var(--color-primary);
    transition: width .3s;
  }

  :host([nav]) a.button-link:hover::after {
    width: 100%;
    transition: width .3s;
  }
`;

let historyPatched = false;

function patchHistory() {
  if (historyPatched) return;
  historyPatched = true;

  const notify = () => window.dispatchEvent(new Event('app-location-change'));

  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    notify();
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args);
    notify();
  };

  window.addEventListener('popstate', notify);
}

patchHistory();

export class AppLink extends LitElement {
  static styles = [LinkStyles];

  @property({ type: String })
  public href: string = '';

  @property({ type: Boolean, reflect: true })
  public active: boolean = false;

  @property({ type: Boolean, reflect: true })
  public nav: boolean = false;

  private updateActive = () => {
    this.active = window.location.pathname === this.href;
  };

  connectedCallback() {
    super.connectedCallback();
    this.updateActive();
    window.addEventListener('app-location-change', this.updateActive);
  }

  disconnectedCallback() {
    window.removeEventListener('app-location-change', this.updateActive);
    super.disconnectedCallback();
  }

  private handleClick(event: Event) {
    event.preventDefault();
    history.pushState({}, '', this.href);
  }

  render() {
    return html`
      <a
        class="button-link ${this.active ? 'active' : ''}"
        href=${this.href}
        @click=${this.handleClick}
      ><slot></slot></a>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-link': AppLink
  }
}

customElements.define('app-link', AppLink);
