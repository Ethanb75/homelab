import { state } from '@lit/reactive-element/decorators/state.js';
import { LitElement, css, html } from 'lit'
import type { PropertyValues } from 'lit'
import { createRef, ref } from 'lit/directives/ref.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import MarkdownIt from 'markdown-it'
import { AtomsStyles } from '../atoms.css.ts'
import PageStyles from '../page.css.ts'

// matches MAX_MESSAGE_LENGTH and MAX_MESSAGES in rag-api/src/routes/schemas.ts
const MAX_MESSAGE_LENGTH = 4000
const MAX_MESSAGES = 20
// each past turn is a user + assistant pair, leaving room for the current question
const MAX_HISTORY_TURNS = Math.floor((MAX_MESSAGES - 1) / 2)

// html: false escapes raw HTML in the model output, so unsafeHTML only ever sees markdown-it's own tags
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

// open links in a new tab so the in-memory chat isn't lost
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return self.renderToken(tokens, idx, options)
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Source {
  source: string
  contentHash: string
  score: number
}

interface Turn {
  question: string
  answer: string
  // rendered markdown, only set once the answer finishes streaming
  answerHtml?: string
  sources: Source[]
  model?: string
  error?: string
}

const GovChatPageStyles = css`
  .gov-chat-page {
    padding: 2rem 0;
  }

  .turn {
    margin-bottom: 2rem;
  }

  .label {
    color: var(--color-primary);
  }

  .question, .answer {
    white-space: pre-wrap;
    margin: 0.25rem 0 1rem 0;
  }

  .answer.markdown {
    white-space: normal;
  }

  .markdown > :first-child {
    margin-top: 0;
  }

  .markdown > :last-child {
    margin-bottom: 0;
  }

  .markdown p, .markdown ul, .markdown ol, .markdown pre, .markdown table {
    margin: 0.5rem 0;
  }

  .markdown ul, .markdown ol {
    padding-left: 1.25rem;
  }

  .markdown li + li {
    margin-top: 0.25rem;
  }

  .markdown h1, .markdown h2, .markdown h3, .markdown h4 {
    margin: 1rem 0 0.5rem 0;
    font-size: 1.1rem;
  }

  .markdown h1 {
    font-size: 1.3rem;
  }

  .markdown h2 {
    font-size: 1.2rem;
  }

  .markdown a {
    color: var(--color-primary);
  }

  .markdown code {
    font-size: 0.9em;
    padding: 0 0.2rem;
    border: 1px solid var(--color-secondary);
  }

  .markdown pre {
    padding: 0.5rem;
    overflow-x: auto;
    border: 1px solid var(--color-secondary);
  }

  .markdown pre code {
    padding: 0;
    border: none;
  }

  .markdown table {
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
  }

  .markdown th, .markdown td {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-secondary);
  }

  .markdown blockquote {
    margin: 0.5rem 0;
    padding-left: 0.75rem;
    border-left: 2px solid var(--color-secondary);
  }

  .error {
    color: #E88D8D;
  }

  .model {
    display: block;
    font-size: 0.8rem;
    color: #AF9085;
    opacity: 0.8;
  }

  .more-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: inherit;
    font-size: 0.9rem;
    color: var(--color-primary);
    background: none;
    border: none;
    padding: 0;
    margin-left: 0.25rem;
    cursor: pointer;
  }

  .more-toggle .arrow {
    display: inline-block;
    transition: transform 0.15s ease;
  }

  .more-toggle .arrow.open {
    transform: rotate(180deg);
  }

  .details {
    font-size: 0.9rem;
    color: #AF9085;
  }

  .sources {
    margin: 0;
    padding-left: 1rem;
    font-size: 0.9rem;
    color: #AF9085;
  }

  .chat-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  textarea {
    font: inherit;
    letter-spacing: inherit;
    color: var(--color-main-text);
    background: transparent;
    border: 1px solid var(--color-secondary);
    padding: 0.5rem;
    min-height: 4rem;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  button {
    font: inherit;
    font-size: 1.2rem;
    color: var(--color-background);
    background: var(--color-primary);
    border: none;
    padding: 0.25rem 1rem;
    cursor: pointer;
  }

  button.reset {
    color: var(--color-primary);
    background: transparent;
    border: 1px solid var(--color-primary);
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  @media (max-width: 600px) {
    .gov-chat-page {
      padding: 15vw 0;
    }
  }
`

const basename = (path: string) => path.split(/[\\/]/).pop() ?? path

const errorForStatus = (status: number, body: any): string => {
  if (status === 429) return 'Too many requests, try again in a minute'
  if (status === 400 && body?.issues?.[0]?.message) return body.issues[0].message
  return 'Something went wrong'
}

export class GovChatPage extends LitElement {
  static styles = [PageStyles, GovChatPageStyles, AtomsStyles]

  // kept in memory only, each request sends recent completed turns as history
  @state()
  private turns: Turn[] = []

  @state()
  private pending = false

  @state()
  private showDetails = false

  private abortController?: AbortController

  private bottomRef = createRef<HTMLDivElement>()

  private textareaRef = createRef<HTMLTextAreaElement>()

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('turns')) {
      this.bottomRef.value?.scrollIntoView({ block: 'end' })
    }
  }

  disconnectedCallback() {
    // closing the connection tells rag-api to stop generating
    this.abortController?.abort()
    super.disconnectedCallback()
  }

  private updateLastTurn(update: Partial<Turn>) {
    const last = this.turns.length - 1
    this.turns = this.turns.map((turn, i) => (i === last ? { ...turn, ...update } : turn))
  }

  private get lastTurn() {
    return this.turns[this.turns.length - 1]
  }

  private toggleDetails = () => {
    this.showDetails = !this.showDetails
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      ;(event.target as HTMLTextAreaElement).form?.requestSubmit()
    }
  }

  // throws away the current chat, aborting any answer still streaming
  private handleReset = () => {
    this.abortController?.abort()
    this.abortController = undefined
    this.turns = []
    this.pending = false
    const textarea = this.textareaRef.value
    if (textarea) {
      textarea.value = ''
      textarea.focus()
    }
  }

  private handleSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const textarea = form.elements.namedItem('question') as HTMLTextAreaElement
    const question = textarea.value.trim()
    if (!question || this.pending) return

    textarea.value = ''
    this.ask(question)
  }

  // failed or empty answers are skipped, rag-api rejects empty content
  private buildHistory(): Message[] {
    return this.turns
      .filter(turn => !turn.error && turn.answer.trim())
      .slice(-MAX_HISTORY_TURNS)
      .flatMap((turn): Message[] => [
        { role: 'user', content: turn.question },
        { role: 'assistant', content: turn.answer.slice(0, MAX_MESSAGE_LENGTH) },
      ])
  }

  private async ask(question: string) {
    this.pending = true
    const messages: Message[] = [...this.buildHistory(), { role: 'user', content: question }]
    this.turns = [...this.turns, { question, answer: '', sources: [] }]
    const controller = new AbortController()
    this.abortController = controller

    try {
      const res = await fetch('/api/v1/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream: true }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        this.updateLastTurn({ error: errorForStatus(res.status, body) })
        return
      }

      const finished = await this.readStream(res.body)
      if (!finished && !this.lastTurn.error) {
        this.updateLastTurn({ error: 'The connection closed before the answer finished' })
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      this.updateLastTurn({ error: 'Something went wrong' })
    } finally {
      // a reset may have already started a new request, don't clobber its pending state
      if (this.abortController === controller) this.pending = false
    }
  }

  // EventSource can't POST, so parse the SSE stream by hand. Returns true once `done` arrives
  private async readStream(body: ReadableStream<Uint8Array>): Promise<boolean> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) return false
      buffer += decoder.decode(value, { stream: true })

      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        
        if (this.handleEvent(block)) return true
      }
    }
  }

  private handleEvent(block: string): boolean {
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    const payload = data ? JSON.parse(data) : {}

    switch (event) {
      case 'model':
        this.updateLastTurn({ model: payload.model })
        return false
      case 'sources':
        this.updateLastTurn({ sources: payload })
        return false
      // the text stream
      case 'delta':
        this.updateLastTurn({ answer: this.lastTurn.answer + payload.text })
        return false
      case 'error':
        this.updateLastTurn({ error: payload.message ?? 'Something went wrong' })
        return true
      case 'done':
        this.updateLastTurn({ answerHtml: md.render(this.lastTurn.answer) })
        return true
      default:
        return false
    }
  }

  private renderSources(sources: Source[]) {
    const maxSources = 4;
    const names = [...new Set(sources.map(s => basename(s.source)).slice(0, maxSources))]
    if (!names.length) return null
    return html`
      <ul class="sources">
        <span>sources:</span>
        ${names.map(name => html`<li>${name}</li>`)}
      </ul>
    `
  }

  // plain text while streaming, markdown once the answer is done
  private renderAnswer(turn: Turn) {
    // done! render markdown
    if (turn.answerHtml) {
      return html`<div class="answer markdown">${unsafeHTML(turn.answerHtml)}</div>`
    }
    return html`<p class="answer">${turn.answer
      || (this.pending && turn === this.lastTurn && !turn.error ? '...' : '')}</p>`
  }

  private renderTurn(turn: Turn) {
    return html`
      <div class="turn">
        <span class="label">&gt; you:</span>
        <p class="question">${turn.question}</p>
        <span class="label">&gt; ${`${turn.model || ""} - GovBot 🤖:`}</span>

        ${this.renderAnswer(turn)}
        ${turn.error ? html`<p class="error">${turn.error}</p>` : null}
        ${this.renderSources(turn.sources)}
      </div>
    `
  }

  render() {
    return html`
      <div class="page gov-chat-page">
        <h1>Gov Chat - WIP</h1>
        <p>
          Ask questions about Georgia executive orders. Answers are generated from the source documents listed underneath each one.
          <button
            type="button"
            class="more-toggle"
            aria-expanded=${this.showDetails}
            @click=${this.toggleDetails}
          >
            more <span class="arrow ${this.showDetails ? 'open' : ''}">▾</span>
          </button>
        </p>
        ${this.showDetails ? html`
          <p class="details">
            GA Executive orders page is crawled once a day and the knowledge is ingested into a qdrant database. An api hits the qdrant
            database to support chat completion with a model (shown above each answer). All services (including FE) are running on my homelab
          </p>
        ` : null}
        <div class="chat-response">
          ${this.turns.map(turn => this.renderTurn(turn))}
          
        </div>
        <form class="chat-form" @submit=${this.handleSubmit}>
          <textarea
            name="question"
            maxlength=${MAX_MESSAGE_LENGTH}
            placeholder="Ask a question..."
            @keydown=${this.handleKeyDown}
            ${ref(this.textareaRef)}
          ></textarea>
          <div class="form-actions">
            <button
              type="button"
              class="reset"
              title="Start a new chat"
              ?disabled=${!this.turns.length}
              @click=${this.handleReset}
            >↻ New chat</button>
            <button type="submit" ?disabled=${this.pending}>Send</button>
          </div>
        </form>
        <div style="margin-top: 5rem" ${ref(this.bottomRef)}></div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gov-chat-page': GovChatPage
  }
}

customElements.define('gov-chat-page', GovChatPage)
