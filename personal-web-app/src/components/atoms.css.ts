import { css } from 'lit';

export const AtomsStyles = css`
  h1 {
    font-family: 'VT323', system-ui, sans-serif;
    font-size: 2.5rem;
  }

  a, a:visited {
    color: #AF9085;  
  }

  a:hover {
    color: var(--color-primary);
    transition: color 0.3s ease;
  }
`