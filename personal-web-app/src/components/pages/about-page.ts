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

  .projects-list dt {
    font-weight: 800;
    font-size: 1.25rem;
    margin-bottom: 0.8rem;
  }

  .projects-list dd span {
    display: block;
    margin-bottom: 0.8rem;
    opacity: 0.75;
    letter-spacing: 0.02rem;
  }

  .projects-list dd {
    margin-bottom: 5rem;
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
        </p>
        <p>
          but then i became a software engineer living in the suburbs of Atlanta, GA. I've been
          engineering on the web since 2014. In my career i've solved a lot of complex problems
          for customers with modern web technologies and product focused techniques.
        </p>

        <h1>Work</h1>
        <h2>Web consultant</h2>
        <!-- date in small letters? -->
        <p>
          I started working at my current position in 2019. Before that, i was working as part of a 2 man team 
          to provide technical soluations and social media, search engine marketing. I got to work with Artists, 
          Chiropractors, Hair salons, activists, landscapers, some of these projects are still live 
          and in use (like <a href="https://www.ice2010.com/" target="_blank" rel="noopener noreferrer">https://www.ice2010.com/</a>)
        </p>

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

        <h2>Senior Engineer</h2>
        <p>
          In my 7 years at Reibus i learned from a lot of amazing mentors and grew quickly. I got hands
          on experience with every project and lead many new projects. 
        </p>
        <br />
        <br />
        <h1>Select Projects</h1>
        <dl class="projects-list">
          <dt>Shipment Visibility Dashboard & Turvo Shipment Integration</dt>
          <dd>
            <span>React - External Integration - SQS - AWS Lambda - Graphql - API Gateway - AWS S3</span>
            A custom logistics dashboard and external data flow integrated with Turvo. My service listened to Turvo webhook events 
            and passed messages to an FIFO SQS queue which fed into a handler lambda to  
            create objects in Algolia. I made a React page that displayed each companies shipments' 
            utilizing a lambda powered api endpoint. the FE allowed for simple search, a google maps route display
            with custom icons, and a 24hr public share link. The page made our logistics customers more sticky 
            and saved logistic account manager hours.
          </dd>

          <dt>Reibus Metals Checkout</dt>
          <dd>
            <span>Stripe API - Design - AWS S3 - API Gateway - AWS Lambda - Graphql</span>
            I created a cart system. It used React context to allow me to quickly 
            cart state data throughout the entire application. In the navigation, users 
            could see the items they had in the cart with a simple side view menu the pulled 
            out when the cart was clicked. I added a cart page to analyze details before proceeded. 
            The page clearly displayed a summary on the product to allow a quick but comprehensive 
            view. The checkout flow i designed based on Amazons checkout flow. the checkout flow 
            had a minimum navbar to keep engagement, and was split into multiple steps to make a 
            complex form seem simple to users. Users could choose to pay directly with Stripe which 
            i integrated into the checkout. Users could also supply documents for checkout. After 
            finalizing a sale the form would show a confirmation to the user. the platform would then 
            store the sale in our database, store the user documents in S3, and notify our internal team 
            members that a sale was made with all details to continue the confirmed sale.
          </dd>

          <dt>Netsuite Finance Integration</dt>
          <dd>
            <span>Netsuite - Fintech - SQS - AWS Lambda - External Integrations - Slack API</span>
            Goal was to keep our finance system in sync with our logistics system. 
            I created listeners for Turvo to automatically push invoices and bills to netsuite. 
            I had to learn a lot about Oracle Netsuite, an old and lightly documented system. 
            I made webhooks out of ns to sync items in Turvo, update shipment statuses. After the 
            first few features, we added more and i became the Netsuite domain expert. Netsuite servers 
            would fail occassionally, so i setup a method to alert when we failed and send a message to 
            slack, and i setup a custom method to store events for re-firing. implemented in an important 
            system for finance so things HAD to be right
          </dd>

          <dt>AI Document Parsing tool</dt>
          <dd>
            <span>OpenAI API - API Gateway - AI Agents</span>
            In order to save time manaully creating line items for financal documents, the stakeholders 
            needed a tool to speed up invoice/bill creation. I created a service that listened 
            to our document SQS queue, utilized AI to parse the document and translate it to line items 
            automatically appended to the proper netsuite file. The document was sent to openai via API, 
            which triggered an agent chain which used diffusion to read the pdf file, then respond with the list 
            of line items as JSON. Handwritten, templated, multi format files were parsed with rare hallucinations.
          </dd>

          <dt>AWS Account Cost Reduction</dt>
          <dd>
            <span>System Analysis - AWS Cost Explorer</span>
            22k a year in savings after 1 wk. had to review data, analyze and prove changes 
            to infrastructure to reduce cost while maintaining performance and uptime. 100% 
            uptime during this process. iterative process where i collaborated during the entire 
            process, providing charts and spreadsheets to show the big picture  2nd pass was 11k/mo 
            to 4k/mo. savings plans, reserved instances, RDS rightsizing, api gateway rightsizing, 
            less logs
          </dd>
        </dl>
        <h2>Check out my github to see what i'm currently tinkering with:</h2>
        <p>
          <a href="https://github.com/Ethanb75" target="_blank" rel="noopener noreferrer">https://github.com/Ethanb75</a>
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
