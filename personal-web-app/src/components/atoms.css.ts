import { css } from 'lit';

export const AtomsStyles = css`
  h1 {
    font-family: 'VT323', system-ui, sans-serif;
    font-size: 2.5rem;
  }

  a {
    color: var(--color-primary);
  }

  // a:hover {
  //   color: var(--color-secondary);
  //   transition: color 0.3s ease;
  // }

  a:visited {
    // color: var(--color-secondary);
    color: #AF9085;
  }

  a.button-link {
    text-decoration: none;
    padding: 1rem;
  }
  a.button-link.active {
    color: var(--color-primary);
  }

  a.button-link::after {
    content: '';
    display: block;
    position: relative;
    top: .5rem;
    width: 0;
    height: 2px;
    background: var(--color-primary);
    transition: width .3s;
  }
  
  a.button-link:hover {
    color: var(--color-primary);
    transition: color 0.3s ease;
  }

  a.button-link:hover::after {
    width: 100%;
    transition: width .3s;
  }
`