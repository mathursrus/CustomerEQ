/**
 * <ceq-support-chat> — Embeddable Web Component for CustomerEQ support chat.
 *
 * Usage:
 *   <ceq-support-chat brand-id="brand_abc" token="member@email.com" api-base="https://api.example.com"></ceq-support-chat>
 *
 * CSS Custom Properties (brand theming):
 *   --ceq-font-family: 'Inter', system-ui, sans-serif
 *   --ceq-primary-color: #4F46E5
 *   --ceq-background-color: #ffffff
 *   --ceq-chat-bubble-color: #4F46E5
 */

interface ChatMessage {
  role: string
  content: string
  timestamp: string
}

const STYLES = `
:host {
  display: block;
  font-family: var(--ceq-font-family, 'Inter', system-ui, sans-serif);
  --primary: var(--ceq-primary-color, #4F46E5);
  --bg: var(--ceq-background-color, #ffffff);
  --bubble: var(--ceq-chat-bubble-color, #4F46E5);
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 99999;
}
.ceq-launcher {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: transform 0.2s ease;
}
.ceq-launcher:hover { transform: scale(1.05); }
.ceq-launcher svg { width: 24px; height: 24px; fill: #fff; }
.ceq-panel {
  display: none;
  flex-direction: column;
  width: 380px;
  height: 520px;
  background: var(--bg);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  overflow: hidden;
}
.ceq-panel.open { display: flex; }
.ceq-header {
  background: var(--primary);
  color: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ceq-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
.ceq-close {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 20px;
  padding: 0;
  line-height: 1;
}
.ceq-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ceq-msg {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}
.ceq-msg.customer {
  align-self: flex-end;
  background: var(--bubble);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.ceq-msg.ai, .ceq-msg.agent {
  align-self: flex-start;
  background: #f3f4f6;
  color: #1f2937;
  border-bottom-left-radius: 4px;
}
.ceq-typing {
  align-self: flex-start;
  padding: 10px 14px;
  background: #f3f4f6;
  border-radius: 12px;
  font-size: 14px;
  color: #9ca3af;
}
.ceq-typing span {
  display: inline-block;
  animation: ceq-bounce 1.4s infinite;
}
.ceq-typing span:nth-child(2) { animation-delay: 0.2s; }
.ceq-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes ceq-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
.ceq-input-area {
  display: flex;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
  gap: 8px;
}
.ceq-input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  resize: none;
}
.ceq-input:focus { border-color: var(--primary); }
.ceq-send {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}
.ceq-send:disabled { opacity: 0.5; cursor: not-allowed; }
.ceq-error {
  padding: 12px 16px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
  text-align: center;
}
`

class CeqSupportChat extends HTMLElement {
  static observedAttributes = ['brand-id', 'token', 'api-base']

  private shadow: ShadowRoot
  private state: 'closed' | 'open' | 'loading' | 'error' = 'closed'
  private conversationId: string | null = null
  private messages: ChatMessage[] = []
  private eventSource: EventSource | null = null
  private isLoading = false

  private get brandId(): string { return this.getAttribute('brand-id') ?? '' }
  private get token(): string { return this.getAttribute('token') ?? '' }
  private get apiBase(): string { return this.getAttribute('api-base') ?? '' }

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
  }

  disconnectedCallback() {
    this.eventSource?.close()
  }

  private render() {
    this.shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="ceq-panel ${this.state === 'closed' ? '' : 'open'}" id="panel">
        <div class="ceq-header">
          <h3>Support Chat</h3>
          <button class="ceq-close" id="close-btn" aria-label="Close chat">&times;</button>
        </div>
        <div class="ceq-messages" id="messages">
          ${this.messages.map((m) => `
            <div class="ceq-msg ${m.role.toLowerCase()}">${this.escapeHtml(m.content)}</div>
          `).join('')}
          ${this.isLoading ? '<div class="ceq-typing"><span>.</span><span>.</span><span>.</span></div>' : ''}
        </div>
        ${this.state === 'error' ? '<div class="ceq-error">Something went wrong. Please try again.</div>' : ''}
        <div class="ceq-input-area">
          <input type="text" class="ceq-input" id="msg-input" placeholder="Type a message..." ${this.isLoading ? 'disabled' : ''}>
          <button class="ceq-send" id="send-btn" ${this.isLoading ? 'disabled' : ''}>Send</button>
        </div>
      </div>
      <button class="ceq-launcher ${this.state !== 'closed' ? 'hidden' : ''}" id="launcher" aria-label="Open support chat" style="${this.state !== 'closed' ? 'display:none' : ''}">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
      </button>
    `

    // Bind events
    this.shadow.getElementById('launcher')?.addEventListener('click', () => this.open())
    this.shadow.getElementById('close-btn')?.addEventListener('click', () => this.close())
    this.shadow.getElementById('send-btn')?.addEventListener('click', () => this.handleSend())
    this.shadow.getElementById('msg-input')?.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') this.handleSend()
    })
  }

  private open() {
    this.state = 'open'
    this.render()
    this.dispatchEvent(new CustomEvent('ceq:chat-opened', { bubbles: true }))
    // Focus input
    setTimeout(() => {
      (this.shadow.getElementById('msg-input') as HTMLInputElement)?.focus()
    }, 100)
  }

  private close() {
    this.state = 'closed'
    this.render()
    this.dispatchEvent(new CustomEvent('ceq:chat-closed', { bubbles: true }))
  }

  private async handleSend() {
    const input = this.shadow.getElementById('msg-input') as HTMLInputElement
    const content = input?.value.trim()
    if (!content || this.isLoading) return

    // Add customer message to UI
    this.messages.push({ role: 'CUSTOMER', content, timestamp: new Date().toISOString() })
    this.isLoading = true
    this.render()

    try {
      if (!this.conversationId) {
        await this.startConversation(content)
      } else {
        await this.sendMessage(content)
      }
      this.dispatchEvent(new CustomEvent('ceq:message-sent', {
        bubbles: true,
        detail: { conversationId: this.conversationId },
      }))
    } catch (err) {
      this.state = 'error'
      this.isLoading = false
      this.render()
    }
  }

  private async startConversation(message: string) {
    const res = await fetch(`${this.apiBase}/v1/public/support/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ memberEmail: this.token, initialMessage: message }),
    })

    if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`)

    const data = await res.json()
    this.conversationId = data.conversationId

    // Connect SSE for real-time updates
    this.connectSSE(data.streamUrl)

    // Poll for AI response (SSE may not be available)
    this.pollForResponse()
  }

  private connectSSE(streamUrl: string) {
    const url = `${this.apiBase}${streamUrl}?token=${encodeURIComponent(this.token)}`
    this.eventSource = new EventSource(url)

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'message') {
          this.messages.push({
            role: data.role,
            content: data.content,
            timestamp: new Date().toISOString(),
          })
          this.isLoading = false
          this.render()
          this.dispatchEvent(new CustomEvent('ceq:message-received', {
            bubbles: true,
            detail: { conversationId: this.conversationId, role: data.role },
          }))
        } else if (data.type === 'status' && data.status === 'ESCALATED') {
          this.dispatchEvent(new CustomEvent('ceq:escalated', {
            bubbles: true,
            detail: { conversationId: this.conversationId, assignee: data.assignee },
          }))
        }
      } catch {
        // Ignore parse errors
      }
    }

    this.eventSource.onerror = () => {
      // SSE connection lost — fall back to polling
      this.eventSource?.close()
      this.eventSource = null
    }
  }

  private async pollForResponse() {
    // Simple polling fallback — check for new messages
    const maxAttempts = 30
    const interval = 2000

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval))

      if (!this.isLoading) return // Response already received via SSE

      try {
        const res = await fetch(
          `${this.apiBase}/v1/public/support/conversations/${this.conversationId}/messages`,
          { headers: { 'Authorization': `Bearer ${this.token}` } },
        )
        if (!res.ok) continue

        const data = await res.json()
        const aiMessages = data.messages.filter(
          (m: ChatMessage) => m.role !== 'CUSTOMER' && !this.messages.some((em) => em.content === m.content && em.role === m.role),
        )
        if (aiMessages.length > 0) {
          for (const msg of aiMessages) {
            this.messages.push({ role: msg.role, content: msg.content, timestamp: msg.createdAt })
          }
          this.isLoading = false
          this.render()
          this.dispatchEvent(new CustomEvent('ceq:message-received', {
            bubbles: true,
            detail: { conversationId: this.conversationId, role: aiMessages[0].role },
          }))
          return
        }
      } catch {
        // Ignore polling errors
      }
    }

    // Timeout — stop loading indicator
    this.isLoading = false
    this.render()
  }

  private async sendMessage(content: string) {
    const res = await fetch(
      `${this.apiBase}/v1/public/support/conversations/${this.conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      },
    )

    if (!res.ok) throw new Error(`Failed to send message: ${res.status}`)

    // Poll for AI response
    this.pollForResponse()
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private scrollToBottom() {
    const container = this.shadow.getElementById('messages')
    if (container) container.scrollTop = container.scrollHeight
  }
}

customElements.define('ceq-support-chat', CeqSupportChat)
