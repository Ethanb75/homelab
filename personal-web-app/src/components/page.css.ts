import { css } from 'lit';

const PageStyles = css`
  :host {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 2rem;
    justify-content: center;
    align-items: center;
  }

  .page {
    width: 38vw;
  }

  @media (max-width: 600px) {
    :host {
      display: block;
    }
  }
 
`

export default PageStyles;