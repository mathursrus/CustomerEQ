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

interface BootConfig {
  brandName: string
  /** Brand-level fields the widget needs at boot (consent + identifier kind). */
  brand?: {
    name: string
    consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
    consentTextDefault: string | null
    privacyPolicyUrl: string | null
    termsUrl: string | null
    memberIdentifierKind: 'EMAIL' | 'PHONE' | 'CUSTOMER_ID'
  }
  theme: {
    primaryColor: string
    accentColor: string
    backgroundColor: string
    textColor: string
    buttonColor: string
    buttonTextColor: string
    fontFamily: string
    borderRadius: string
  }
  widget: {
    position: 'BOTTOM_RIGHT' | 'BOTTOM_LEFT'
    launcherIconUrl: string | null
    darkModeAuto: boolean
    greeting: string
    offlineMessage: string
    csatPromptText: string
    escalateButtonText: string
    showCsatAfterAi: boolean
    csatTimeoutSeconds: number
    anonAllowed: boolean
  }
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
.ceq-launcher img { width: 28px; height: 28px; object-fit: contain; }
.ceq-panel {
  display: none;
  flex-direction: column;
  width: 380px;
  max-width: calc(100vw - 24px);
  height: 520px;
  max-height: calc(100vh - 24px);
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
.ceq-agent-banner {
  margin: 4px 0;
  padding: 8px 12px;
  background: #f0fdf4;
  border-left: 3px solid #22c55e;
  border-radius: 4px;
  font-size: 12px;
  color: #166534;
  align-self: stretch;
}
.ceq-csat-bar {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #4b5563;
}
.ceq-csat-bar button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s;
}
.ceq-csat-bar button:hover { background: #e5e7eb; }
.ceq-offline-msg {
  padding: 16px;
  background: #fef9c3;
  color: #713f12;
  font-size: 13px;
  border-top: 1px solid #fde68a;
  text-align: center;
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
.ceq-consent-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px 0;
  font-size: 12px;
  color: #4b5563;
  line-height: 1.4;
}
.ceq-consent-row input[type="checkbox"] {
  margin-top: 2px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--primary);
}
.ceq-consent-row label { cursor: pointer; }
.ceq-disclosure {
  padding: 8px 12px 10px;
  font-size: 11px;
  color: #6b7280;
  line-height: 1.45;
  border-top: 1px solid #f3f4f6;
}
.ceq-disclosure a { color: var(--primary); text-decoration: underline; }
.ceq-error {
  padding: 12px 16px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
  text-align: center;
}
`

interface CeqIdentity {
  email?: string
  name?: string
  externalId?: string
}

class CeqSupportChat extends HTMLElement {
  static observedAttributes = ['brand-id', 'token', 'api-base']

  private shadow: ShadowRoot
  private state: 'closed' | 'open' | 'loading' | 'error' = 'closed'
  private conversationId: string | null = null
  private messages: ChatMessage[] = []
  private eventSource: EventSource | null = null
  private isLoading = false
  private bootConfig: BootConfig | null = null
  private escalatedBannerShown = false
  private csatSubmitted = false
  private statusPollTimer: ReturnType<typeof setTimeout> | null = null
  private csatTimers: Map<number, ReturnType<typeof setTimeout>> = new Map()
  private identity: CeqIdentity | null = null
  private bootReady = false
  private onReadyCallbacks: Array<() => void> = []
  /**
   * Per-brand consent acknowledgement state. For brands in EXPLICIT consent mode,
   * Send is disabled until the visitor ticks the checkbox above the composer.
   * Persisted in a per-brand cookie (`ceq_consent_<brandId>=1`) so the visitor
   * doesn't re-tick on every page load.
   */
  private consentAcknowledged = false

  private get brandId(): string { return this.getAttribute('brand-id') ?? '' }
  private get token(): string { return this.getAttribute('token') ?? '' }
  private get apiBase(): string { return this.getAttribute('api-base') ?? '' }

  /**
   * The email used as Bearer when authenticating against the API. The widget
   * supports three identity sources, in precedence order:
   *   1. `token` attribute on the element (legacy two-tag embed)
   *   2. `identify({email})` called via window.CEQ.push(['identify', {...}])
   *   3. None → anonymous flow (anonId cookie)
   */
  private getEffectiveToken(): string | null {
    return this.token || this.identity?.email || null
  }

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
    this.loadBootConfig()
  }

  disconnectedCallback() {
    this.eventSource?.close()
    if (this.statusPollTimer) clearTimeout(this.statusPollTimer)
    this.csatTimers.forEach((t) => clearTimeout(t))
  }

  // ─── Boot config + theming ────────────────────────────────────────────────

  private async loadBootConfig(): Promise<void> {
    if (!this.apiBase || !this.brandId) {
      this.markBootReady()
      return
    }
    try {
      const url = `${this.apiBase}/v1/public/support/widget-config?brandId=${encodeURIComponent(this.brandId)}`
      const res = await fetch(url)
      if (!res.ok) {
        this.bootConfig = null
      } else {
        this.bootConfig = await res.json() as BootConfig
        this.applyTheme()
        this.applyWidgetCopy()
        this.consentAcknowledged = this.loadConsentAck()
      }
    } catch {
      this.bootConfig = null
    } finally {
      this.markBootReady()
    }
  }

  /** Mark the widget as boot-ready and flush any queued onReady callbacks. */
  private markBootReady(): void {
    if (this.bootReady) return
    this.bootReady = true
    const callbacks = this.onReadyCallbacks.splice(0)
    for (const cb of callbacks) {
      try {
        cb()
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ceq-support-chat] onReady callback threw', err)
      }
    }
  }

  private applyTheme(): void {
    if (!this.bootConfig) return
    const host = this.shadowRoot!.host as HTMLElement
    const t = this.bootConfig.theme
    host.style.setProperty('--ceq-primary-color', t.primaryColor)
    host.style.setProperty('--ceq-background-color', t.backgroundColor)
    host.style.setProperty('--ceq-chat-bubble-color', t.accentColor)
    host.style.setProperty('--ceq-font-family', t.fontFamily)
    if (this.bootConfig.widget.darkModeAuto && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      host.style.setProperty('--ceq-background-color', '#1a1a1a')
      host.style.setProperty('--ceq-primary-color', t.primaryColor)
    }
  }

  private applyWidgetCopy(): void {
    if (!this.bootConfig) return

    // Reposition the host element based on widget.position
    const host = this.shadowRoot!.host as HTMLElement
    if (this.bootConfig.widget.position === 'BOTTOM_LEFT') {
      host.style.left = '20px'
      host.style.right = 'auto'
    } else {
      host.style.right = '20px'
      host.style.left = 'auto'
    }

    // Swap launcher icon if a custom URL is set
    const launcher = this.shadowRoot!.querySelector('.ceq-launcher')
    if (launcher && this.bootConfig.widget.launcherIconUrl) {
      launcher.innerHTML = `<img src="${this.escapeAttr(this.bootConfig.widget.launcherIconUrl)}" alt="" />`
    }

    // Inject greeting as first AI message if messages list is empty
    if (this.messages.length === 0) {
      this.messages.push({
        role: 'AI',
        content: this.bootConfig.widget.greeting,
        timestamp: new Date().toISOString(),
      })
      // Re-render messages area only (avoid full re-render that would reset focus)
      this.render()
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private get isAnonBlocked(): boolean {
    return this.bootConfig?.widget.anonAllowed === false && !this.token
  }

  private render(scrollToEnd = false) {
    const panelTitle = this.bootConfig?.brandName ?? 'Support Chat'

    this.shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="ceq-panel ${this.state === 'closed' ? '' : 'open'}" id="panel">
        <div class="ceq-header">
          <h3>${this.escapeHtml(panelTitle)}</h3>
          <button class="ceq-close" id="close-btn" aria-label="Close chat">&times;</button>
        </div>
        <div class="ceq-messages" id="messages" aria-live="polite" role="log">
          ${this.renderMessages()}
          ${this.isLoading ? '<div class="ceq-typing" aria-label="Agent is typing"><span>.</span><span>.</span><span>.</span></div>' : ''}
          ${this.escalatedBannerShown ? '<div class="ceq-agent-banner">An agent has joined the conversation.</div>' : ''}
        </div>
        ${this.state === 'error' ? '<div class="ceq-error">Something went wrong. Please try again.</div>' : ''}
        ${this.isAnonBlocked
          ? `<div class="ceq-offline-msg">${this.escapeHtml(this.bootConfig?.widget.offlineMessage ?? "We're not online right now. Leave us a message and we'll get back to you.")}</div>`
          : `${this.isBlockedByConsent()
              ? `<div class="ceq-consent-row">
                  <input type="checkbox" id="consent-checkbox" aria-describedby="consent-disclosure">
                  <label for="consent-checkbox">${this.renderConsentText() || 'I agree to the privacy policy and terms.'}</label>
                </div>`
              : ''}
            <div class="ceq-input-area">
              <input type="text" class="ceq-input" id="msg-input" placeholder="Type a message..." ${this.isLoading || this.isBlockedByConsent() ? 'disabled' : ''}>
              <button class="ceq-send" id="send-btn" ${this.isLoading || this.isBlockedByConsent() ? 'disabled' : ''}>Send</button>
            </div>
            ${!this.isBlockedByConsent() && this.bootConfig?.brand?.consentTextDefault
              ? `<div class="ceq-disclosure" id="consent-disclosure">${this.renderConsentText()}</div>`
              : ''}`
        }
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
      if ((e as KeyboardEvent).key === 'Escape') this.close()
    })
    this.shadow.getElementById('consent-checkbox')?.addEventListener('change', (e) => {
      const checked = (e.currentTarget as HTMLInputElement).checked
      if (checked) {
        this.consentAcknowledged = true
        this.saveConsentAck()
        this.render()
        setTimeout(() => {
          (this.shadow.getElementById('msg-input') as HTMLInputElement)?.focus()
        }, 0)
      }
    })

    // Bind CSAT click handlers
    this.shadow.querySelectorAll('[data-csat]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const rating = (e.currentTarget as HTMLElement).getAttribute('data-csat') as 'THUMBS_UP' | 'THUMBS_DOWN'
        this.onCsatClick(rating)
      })
    })

    if (scrollToEnd) {
      this.scrollToBottom()
    }
  }

  private renderMessages(): string {
    const showCsat = this.bootConfig?.widget.showCsatAfterAi ?? false
    const csatPrompt = this.bootConfig?.widget.csatPromptText ?? 'Did this help?'

    return this.messages.map((m, i) => {
      const msgHtml = `<div class="ceq-msg ${m.role.toLowerCase()}">${this.escapeHtml(m.content)}</div>`
      const isAiOrAgent = m.role === 'AI' || m.role === 'AGENT'
      // Show CsatBar after AI/agent messages if enabled
      const csatHtml = (showCsat && isAiOrAgent)
        ? `<div class="ceq-csat-bar" data-msg-idx="${i}">
            <span>${this.escapeHtml(csatPrompt)}</span>
            <button data-csat="THUMBS_UP" aria-label="Thumbs up">&#128077;</button>
            <button data-csat="THUMBS_DOWN" aria-label="Thumbs down">&#128078;</button>
           </div>`
        : ''
      return msgHtml + csatHtml
    }).join('')
  }

  // ─── Public API (also used by window.CEQ queue commands) ──────────────────

  /** Open the chat panel. Same as the user clicking the launcher bubble. */
  open() {
    this.state = 'open'
    this.render()
    this.dispatchEvent(new CustomEvent('ceq:chat-opened', { bubbles: true }))
    // Focus input
    setTimeout(() => {
      (this.shadow.getElementById('msg-input') as HTMLInputElement)?.focus()
    }, 100)
  }

  /** Close the chat panel back to the launcher state. */
  close() {
    this.state = 'closed'
    this.render()
    this.dispatchEvent(new CustomEvent('ceq:chat-closed', { bubbles: true }))
  }

  /**
   * Identify the current visitor so the next conversation links to a Member.
   * Email is used as a Bearer token at the API boundary (same model as the
   * legacy `token` attribute — unsigned, host-page-trusted).
   *
   * Limitation: if a conversation is already in progress, the identity applies
   * only to FUTURE conversations in this session. The current anon conversation
   * stays anon. Call identify() BEFORE the visitor sends their first message.
   */
  identify(identity: CeqIdentity): void {
    // v1 only supports EMAIL brands on the identify path. For PHONE / CUSTOMER_ID
    // brands the Bearer flow returns 422; rather than letting the request fail
    // mid-conversation, refuse to set identity here so the widget falls through
    // to the anonymous flow (which has no identifier-kind constraint).
    const kind = this.bootConfig?.brand?.memberIdentifierKind
    if (kind && kind !== 'EMAIL') {
      // eslint-disable-next-line no-console
      console.warn(
        `[ceq-support-chat] identify() not yet supported for brands with memberIdentifierKind=${kind}; falling through to anonymous flow.`,
      )
      return
    }
    this.identity = { ...identity }
    if (this.conversationId) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ceq-support-chat] identify() called after a conversation was already started; identity will apply to the next conversation only.',
      )
    }
  }

  /**
   * Clear the visitor identity AND the anonId cookie. Useful when the host
   * page logs the user out. Ends the current SSE/poll loop so the next message
   * starts a fresh conversation.
   */
  reset(): void {
    this.identity = null
    // Drop the anon cookie so a fresh anonId is generated on next conversation
    document.cookie = 'ceq_anon_id=; path=/; max-age=0; SameSite=Lax'
    // End current session
    this.eventSource?.close()
    this.eventSource = null
    if (this.statusPollTimer) {
      clearTimeout(this.statusPollTimer)
      this.statusPollTimer = null
    }
    this.csatTimers.forEach((t) => clearTimeout(t))
    this.csatTimers.clear()
    this.conversationId = null
    this.messages = []
    this.escalatedBannerShown = false
    this.csatSubmitted = false
    this.isLoading = false
    this.render()
  }

  /**
   * Register a callback that fires once the widget has loaded its boot config
   * (or failed gracefully). If the widget is already ready, the callback fires
   * synchronously on the next microtask.
   */
  onReady(callback: () => void): void {
    if (this.bootReady) {
      queueMicrotask(callback)
      return
    }
    this.onReadyCallbacks.push(callback)
  }

  // ─── Send / conversation ───────────────────────────────────────────────────

  private async handleSend() {
    const input = this.shadow.getElementById('msg-input') as HTMLInputElement
    const content = input?.value.trim()
    if (!content || this.isLoading) return

    // Add customer message to UI
    this.messages.push({ role: 'CUSTOMER', content, timestamp: new Date().toISOString() })
    this.isLoading = true
    this.render(true)

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
    const effectiveToken = this.getEffectiveToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const body: Record<string, string> = { initialMessage: message }

    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`
      // Always include X-Brand-Id so the server can do the canonical
      // brandId_externalId member lookup (no cross-brand email collisions).
      headers['X-Brand-Id'] = this.brandId
      // body.email is captured on the conversation row even when Bearer is the
      // source of truth; harmless duplication that helps cross-checking in logs.
      body['email'] = effectiveToken
      body['memberEmail'] = effectiveToken
    } else {
      headers['X-Brand-Id'] = this.brandId
      body['anonId'] = this.getOrCreateAnonId()
      if (this.consentAcknowledged) {
        ;(body as Record<string, unknown>)['consent'] = true
      }
    }

    const res = await fetch(`${this.apiBase}/v1/public/support/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`)

    const data = await res.json()
    this.conversationId = data.conversationId

    // Connect SSE for real-time updates
    this.connectSSE(data.streamUrl)

    // Poll for AI response (SSE may not be available)
    this.pollForResponse()

    // Start polling conversation status for escalation detection
    this.statusPollTimer = setTimeout(() => this.pollStatus(), 30_000)
  }

  private connectSSE(streamUrl: string) {
    const effectiveToken = this.getEffectiveToken()
    let url: string
    if (effectiveToken) {
      url = `${this.apiBase}${streamUrl}?token=${encodeURIComponent(effectiveToken)}`
    } else {
      // Anonymous: pass anonId as query param
      const anonId = this.getOrCreateAnonId()
      url = `${this.apiBase}${streamUrl}?anonId=${encodeURIComponent(anonId)}`
    }
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
          this.render(true)
          this.dispatchEvent(new CustomEvent('ceq:message-received', {
            bubbles: true,
            detail: { conversationId: this.conversationId, role: data.role },
          }))
        } else if (data.type === 'status' && data.status === 'ESCALATED') {
          this.showAgentJoinedBanner()
          this.dispatchEvent(new CustomEvent('ceq:escalated', {
            bubbles: true,
            detail: { conversationId: this.conversationId, assignee: data.assignee },
          }))
        } else if (data.type === 'conversation_status_change' && data.status === 'ESCALATED') {
          this.showAgentJoinedBanner()
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
        const headers: Record<string, string> = {}
        const effectiveToken = this.getEffectiveToken()
        if (effectiveToken) {
          headers['Authorization'] = `Bearer ${effectiveToken}`
        }
        const res = await fetch(
          `${this.apiBase}/v1/public/support/conversations/${this.conversationId}/messages`,
          { headers },
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
          this.render(true)
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
    const effectiveToken = this.getEffectiveToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const body: Record<string, string> = { content }

    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`
    } else {
      headers['X-Brand-Id'] = this.brandId
      body['anonId'] = this.getOrCreateAnonId()
    }

    const res = await fetch(
      `${this.apiBase}/v1/public/support/conversations/${this.conversationId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) throw new Error(`Failed to send message: ${res.status}`)

    // Poll for AI response
    this.pollForResponse()
  }

  // ─── Anonymous flow ────────────────────────────────────────────────────────

  private getOrCreateAnonId(): string {
    const COOKIE = 'ceq_anon_id'
    const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]+)'))
    if (match) return decodeURIComponent(match[1])
    const id = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    document.cookie = `${COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    return id
  }

  // ─── Consent (Brand.consentMode = EXPLICIT) ───────────────────────────────

  private consentCookieKey(): string {
    return `ceq_consent_${this.brandId}`
  }

  private loadConsentAck(): boolean {
    if (!this.brandId) return false
    const re = new RegExp('(?:^|; )' + this.consentCookieKey() + '=1(?:;|$)')
    return re.test(document.cookie)
  }

  private saveConsentAck(): void {
    if (!this.brandId) return
    document.cookie = `${this.consentCookieKey()}=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  }

  /**
   * Inline render of the brand's `consentTextDefault`. Replaces `{{privacy}}`
   * and `{{terms}}` tokens with anchor links pointing to the brand's policy URLs.
   * Mirrors the token grammar from packages/consent-text (the surveys module's
   * helper) without pulling in that package as a runtime dep — keeps the
   * widget bundle lean.
   *
   *   token format: {{privacy}} | {{privacy:"custom label"}}
   */
  private renderConsentText(): string {
    const brand = this.bootConfig?.brand
    const raw = brand?.consentTextDefault
    if (!raw) return ''
    const escaped = this.escapeHtml(raw)
    return escaped.replace(
      /\{\{(privacy|terms)(?::&quot;([^&<>]{1,80})&quot;)?\}\}/g,
      (_match, kind: string, customLabel?: string) => {
        const url = kind === 'privacy' ? brand?.privacyPolicyUrl : brand?.termsUrl
        const fallback = kind === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'
        const label = this.escapeHtml(customLabel ?? fallback)
        if (!url) return label // no URL configured — render plain label
        return `<a href="${this.escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      },
    )
  }

  /** True iff Send should be disabled pending an EXPLICIT consent click. */
  private isBlockedByConsent(): boolean {
    return (
      this.bootConfig?.brand?.consentMode === 'EXPLICIT' &&
      !this.consentAcknowledged
    )
  }

  // ─── Agent escalation polling ─────────────────────────────────────────────

  private async pollStatus(): Promise<void> {
    if (!this.conversationId) return
    try {
      const res = await fetch(`${this.apiBase}/v1/public/support/conversations/${this.conversationId}`)
      if (res.ok) {
        const conv = await res.json()
        if (conv.status === 'ESCALATED' && !this.escalatedBannerShown) {
          this.showAgentJoinedBanner()
        }
      }
    } catch {
      // swallow
    }
    this.statusPollTimer = setTimeout(() => this.pollStatus(), 30_000)
  }

  private showAgentJoinedBanner(): void {
    if (this.escalatedBannerShown) return
    this.escalatedBannerShown = true
    this.render(true)
  }

  // ─── CSAT ─────────────────────────────────────────────────────────────────

  private async onCsatClick(rating: 'THUMBS_UP' | 'THUMBS_DOWN'): Promise<void> {
    if (!this.conversationId) return
    if (this.csatSubmitted) return // prevent double-submit
    const body: Record<string, string> = { rating }
    if (!this.token) body.anonId = this.getOrCreateAnonId()
    try {
      const res = await fetch(
        `${this.apiBase}/v1/public/support/conversations/${this.conversationId}/csat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (res.ok) {
        this.csatSubmitted = true
        this.renderCsatThanks(rating)
      } else {
        // Leave CsatBar visible — customer can retry
        // eslint-disable-next-line no-console
        console.warn('[ceq-support-chat] CSAT submit failed', res.status)
      }
    } catch (err) {
      // network error — leave CsatBar visible
      // eslint-disable-next-line no-console
      console.warn('[ceq-support-chat] CSAT submit network error', err)
    }
  }

  private renderCsatThanks(rating: 'THUMBS_UP' | 'THUMBS_DOWN'): void {
    const root = this.shadowRoot
    if (!root) return
    const bar = root.querySelector('.ceq-csat-bar')
    if (bar) {
      const text = rating === 'THUMBS_UP'
        ? 'Thanks for your feedback!'
        : "Sorry — we'll follow up."
      bar.innerHTML = `<div class="ceq-csat-thanks" style="padding:8px 12px;font-size:13px;color:#666;">${text}</div>`
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private escapeAttr(text: string): string {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  private scrollToBottom() {
    const container = this.shadow.getElementById('messages')
    if (container) container.scrollTop = container.scrollHeight
  }
}

customElements.define('ceq-support-chat', CeqSupportChat)

// ─────────────────────────────────────────────────────────────────────────────
// IIFE bootstrap — auto-init from `<script data-brand-id=... data-api-base=...>`
// and drain any pre-existing `window.CEQ` command queue (Crisp-style).
//
// Backwards-compat: if the host page already placed a `<ceq-support-chat>`
// element in the DOM (legacy two-tag embed), we bind the queue to THAT element
// and do NOT create a second one.
// ─────────────────────────────────────────────────────────────────────────────

type CeqCommand =
  | ['identify', CeqIdentity]
  | ['reset']
  | ['open']
  | ['close']
  | ['onReady', () => void]

interface CeqQueue {
  push: (cmd: CeqCommand) => void
}

declare global {
  interface Window {
    CEQ?: CeqCommand[] | CeqQueue
  }
}

// Capture currentScript synchronously — this only works during script eval.
const _ceqCurrentScript =
  typeof document !== 'undefined'
    ? (document.currentScript as HTMLScriptElement | null)
    : null

;(function bootstrapCeq() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  // 1. Locate the script tag whose data-* attrs configure the widget.
  const scriptEl =
    _ceqCurrentScript ??
    document.querySelector<HTMLScriptElement>(
      'script[data-brand-id][src*="ceq-support-chat"]',
    )

  // 2. Find an existing custom element (legacy two-tag embed). If one exists,
  //    bind the queue to it. Otherwise, auto-create from data-attrs.
  let el = document.querySelector<CeqSupportChat>('ceq-support-chat')
  let createdNew = false

  if (!el && scriptEl) {
    const brandId = scriptEl.dataset.brandId
    if (!brandId) return // not configured — nothing to do

    el = document.createElement('ceq-support-chat') as CeqSupportChat
    el.setAttribute('brand-id', brandId)
    if (scriptEl.dataset.apiBase) el.setAttribute('api-base', scriptEl.dataset.apiBase)
    if (scriptEl.dataset.token) el.setAttribute('token', scriptEl.dataset.token)
    createdNew = true
  }

  if (!el) return // neither auto-init data-attrs nor an existing element — nothing to do

  const target = el

  const handleCommand = (cmd: CeqCommand) => {
    try {
      switch (cmd[0]) {
        case 'identify': target.identify(cmd[1]); break
        case 'reset': target.reset(); break
        case 'open': target.open(); break
        case 'close': target.close(); break
        case 'onReady': target.onReady(cmd[1]); break
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ceq-support-chat] queue command failed', cmd[0], err)
    }
  }

  // 3. Snapshot any pre-existing queue from the host page.
  const existing = window.CEQ
  const queuedCmds: CeqCommand[] = Array.isArray(existing) ? existing.slice() : []

  // 4. Replace window.CEQ with a real object so subsequent host pushes run eagerly.
  window.CEQ = { push: handleCommand }

  // 5. Mount the new element BEFORE draining identify-style commands so that
  //    connectedCallback has run by the time the command hits the instance.
  if (createdNew) {
    // Append on next microtask if body isn't ready yet (script tag in <head>).
    const append = () => document.body.appendChild(target)
    if (document.body) append()
    else document.addEventListener('DOMContentLoaded', append, { once: true })
  }

  // 6. Drain queued commands.
  for (const cmd of queuedCmds) handleCommand(cmd)
})()
