import { LitElement, css, html } from 'lit'
import { AtomsStyles } from '../atoms.css.ts'
import PageStyles from '../page.css.ts'

const AboutPageStyles = css`
  .about-page {
    padding: 2rem 0;
  }

  .about-picture {
    text-align: center;
  }

  .about-picture img {
    width: 800px
  }

  @media (max-width: 2000px) {

    .about-picture img {
      width: 500px
    }
  }

  @media (max-width: 600px) {
    .about-page {
      padding: 15vw 0;
    }

    .about-picture img {
      width: 100%
    }
  }
`

export class AboutPage extends LitElement {
  static styles = [PageStyles, AboutPageStyles, AtomsStyles]

  render() {
    return html`
      <div class="page about-page">
        <h1>About Ethan</h1>
        <p>
          At one point, i was just a baby!
          <!-- baby pic -->
        </p>
        <p>
          but then i became a software engineer living in the suburbs of Atlanta, GA. I've been
          engineering on the web since 2014.
        </p>

        <h1>Work</h1>
        <h2>Web consultant</h2>
        <!-- date in small letters? -->
        <p>WIP</p>

        <h2>Reibus International</h2>
        <p>
          A steel b2b marketplace focusing on anonymized steel sales. 
          First engineer hired. Built first version of the Reibus application
          with a react frontend hosted on s3 with lambda functions serving site
          data using API Gateway. The early version had:
        </p>
        <ul>
          <li>
            Search backed by Algoliasearch which got us powerful and
            performant search very quickly.
          </li>
          <li>
            A checkout with s3 file uploads and nodemailer email alerts. Which
            helped facilitate 10, 20, 30 thousand dollar transactions online smoothly.
          </li>
          <li>
            A simple logistics estimator based on zip code lookup which helped user calculate landed cost.
          </li>
        </ul>
        <p>
          The company grew quickly and i got to work with a lot of great
          engineers on interesting and impactful projects.
        </p>
        <p class="about-picture">
          <picture>
            <source srcset="/austin-anon.webp" type="image/webp" />
            <img src="/austin-anon.jpeg" alt="Company Dinner Party" />
          </picture>
        </p>

        <h2>Get in Touch</h2>
        <p>
          Vestibulum ante ipsum primis in faucibus orci luctus et ultrices
          posuere cubilia curae; Donec velit neque, auctor sit amet aliquam
          vel, ullamcorper sit amet ligula.
        </p>
        <br />
        <br />
        <h1>About</h1>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
          ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </p>

        <h2>Background</h2>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse
          cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
          cupidatat non proident, sunt in culpa qui officia deserunt mollit
          anim id est laborum.
        </p>

        <h2>Interests</h2>
        <p>
          Curabitur pretium tincidunt lacus, ut interdum tellus elit sed
          risus. Maecenas eget condimentum velit, sit amet feugiat lectus.
          Class aptent taciti sociosqu ad litora torquent per conubia
          nostra, per inceptos himenaeos.
        </p>

        <h2>Get in Touch</h2>
        <p>
          Vestibulum ante ipsum primis in faucibus orci luctus et ultrices
          posuere cubilia curae; Donec velit neque, auctor sit amet aliquam
          vel, ullamcorper sit amet ligula.
        </p>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'about-page': AboutPage
  }
}

customElements.define('about-page', AboutPage)
