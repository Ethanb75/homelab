import { state } from '@lit/reactive-element/decorators/state.js';
import { LitElement, css, html } from 'lit'
import { AtomsStyles } from '../atoms.css.ts'
import PageStyles from '../page.css.ts'

// matches MAX_MESSAGE_LENGTH in rag-api/src/routes/schemas.ts
const MAX_MESSAGE_LENGTH = 4000

interface Source {
  source: string
  contentHash: string
  score: number
}

interface Turn {
  question: string
  answer: string
  sources: Source[]
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

  .error {
    color: #E88D8D;
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

  button {
    align-self: flex-end;
    font: inherit;
    font-size: 1.2rem;
    color: var(--color-background);
    background: var(--color-primary);
    border: none;
    padding: 0.25rem 1rem;
    cursor: pointer;
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

  // kept in memory only, each request sends just the current question
  @state()
  private turns: Turn[] = []

  @state()
  private pending = false

  private abortController?: AbortController

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

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      ;(event.target as HTMLTextAreaElement).form?.requestSubmit()
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

  private async ask(question: string) {
    this.pending = true
    this.turns = [...this.turns, { question, answer: '', sources: [] }]
    this.abortController = new AbortController()

    try {
      const res = await fetch('/api/v1/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: question }], stream: true }),
        signal: this.abortController.signal,
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null)
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
      this.pending = false
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
      case 'sources':
        this.updateLastTurn({ sources: payload })
        return false
      case 'delta':
        this.updateLastTurn({ answer: this.lastTurn.answer + payload.text })
        return false
      case 'error':
        this.updateLastTurn({ error: payload.message ?? 'Something went wrong' })
        return true
      case 'done':
        return true
      default:
        return false
    }
  }

  private renderSources(sources: Source[]) {
    const names = [...new Set(sources.map(s => basename(s.source)))]
    if (!names.length) return null
    return html`
      <ul class="sources">
        ${names.map(name => html`<li>${name}</li>`)}
      </ul>
    `
  }

  private renderTurn(turn: Turn) {
    return html`
      <div class="turn">
        <span class="label">&gt; you</span>
        <p class="question">${turn.question}</p>
        <p class="answer">${turn.answer || (this.pending && turn === this.lastTurn && !turn.error ? '...' : '')}</p>
        ${turn.error ? html`<p class="error">${turn.error}</p>` : null}
        ${this.renderSources(turn.sources)}
      </div>
    `
  }

  render() {
    return html`
      <div class="page gov-chat-page">
        <h1>Gov Chat</h1>
        <p>Ask questions about Georgia executive orders. Answers are generated from the source documents listed underneath each one.</p>
        ${this.turns.map(turn => this.renderTurn(turn))}
        <form class="chat-form" @submit=${this.handleSubmit}>
          <textarea
            name="question"
            maxlength=${MAX_MESSAGE_LENGTH}
            placeholder="Ask a question..."
            @keydown=${this.handleKeyDown}
          ></textarea>
          <button type="submit" ?disabled=${this.pending}>Send</button>
        </form>
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
