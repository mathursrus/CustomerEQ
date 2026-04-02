/**
 * <ceq-spin-wheel> — Embeddable Web Component for CustomerEQ spin-the-wheel campaigns.
 *
 * Usage:
 *   <ceq-spin-wheel campaign-id="camp_abc123" token="member-jwt-token"></ceq-spin-wheel>
 *
 * CSS Custom Properties (for brand theming):
 *   --ceq-font-family: 'Inter', system-ui, sans-serif
 *   --ceq-primary-color: #4F46E5
 *   --ceq-background-color: #1e1b4b
 */

interface Segment {
  label: string
  color: string
  index: number
}

interface PlayResponse {
  alreadyPlayed: boolean
  segments?: Segment[]
  winningIndex?: number
  wheelStyle?: string
  reward?: {
    type: string
    points: number
    label: string
    rewardId?: string | null
  }
}

const STYLES = `
:host {
  display: block;
  font-family: var(--ceq-font-family, 'Inter', system-ui, sans-serif);
  --primary: var(--ceq-primary-color, #4F46E5);
  --bg: var(--ceq-background-color, #1e1b4b);
}
.ceq-container {
  background: linear-gradient(135deg, var(--bg) 0%, #312e81 50%, #4338ca 100%);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  color: #fff;
  max-width: 420px;
  margin: 0 auto;
}
.ceq-title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
.ceq-subtitle { font-size: 14px; color: rgba(255,255,255,0.7); margin: 0 0 20px; }
.ceq-wheel-wrapper { position: relative; width: 280px; height: 280px; margin: 0 auto 16px; }
.ceq-pointer {
  position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 12px solid transparent; border-right: 12px solid transparent;
  border-top: 22px solid #fbbf24; z-index: 3;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}
canvas { border-radius: 50%; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
.ceq-spin-btn {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  cursor: pointer; font-size: 12px; font-weight: 700; color: #1e1b4b;
  text-transform: uppercase; letter-spacing: 0.5px; z-index: 2;
}
.ceq-spin-btn:hover { transform: translate(-50%, -50%) scale(1.05); }
.ceq-spin-btn:disabled { cursor: not-allowed; opacity: 0.7; }
.ceq-hint { font-size: 12px; color: rgba(255,255,255,0.5); margin: 0; }
.ceq-result {
  margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.1);
  border-radius: 12px;
}
.ceq-result-title { font-size: 20px; font-weight: 700; color: #10b981; margin: 0 0 4px; }
.ceq-result-prize { font-size: 16px; font-weight: 600; margin: 0; }
.ceq-error { color: #fca5a5; font-size: 14px; margin-top: 12px; }
.ceq-loading { color: rgba(255,255,255,0.5); font-size: 14px; padding: 40px 0; }
`

class CeqSpinWheel extends HTMLElement {
  static observedAttributes = ['campaign-id', 'token', 'api-base']

  private shadow: ShadowRoot
  private state: 'loading' | 'ready' | 'spinning' | 'done' | 'error' | 'already-played' = 'loading'
  private segments: Segment[] = []
  private winningIndex = 0
  private reward: PlayResponse['reward'] = undefined
  private canvas: HTMLCanvasElement | null = null
  private currentRotation = 0
  private errorMessage = ''

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  get campaignId() { return this.getAttribute('campaign-id') ?? '' }
  get token() { return this.getAttribute('token') ?? '' }
  get apiBase() { return this.getAttribute('api-base') ?? '' }

  connectedCallback() {
    this.render()
    this.fetchConfig()
  }

  private async fetchConfig() {
    if (!this.campaignId || !this.token) {
      this.state = 'error'
      this.errorMessage = 'Missing campaign-id or token attribute'
      this.render()
      return
    }

    const baseUrl = this.apiBase || window.location.origin
    try {
      const res = await fetch(`${baseUrl}/v1/public/campaigns/${this.campaignId}/play`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        this.state = 'error'
        this.errorMessage = data.error ?? `HTTP ${res.status}`
        this.render()
        return
      }

      const data: PlayResponse = await res.json()

      if (data.alreadyPlayed) {
        this.state = 'already-played'
        this.reward = data.reward
        this.render()
        return
      }

      this.segments = data.segments ?? []
      this.winningIndex = data.winningIndex ?? 0
      this.reward = data.reward
      this.state = 'ready'
      this.render()
      this.drawWheel(0)
    } catch {
      this.state = 'error'
      this.errorMessage = 'Network error. Please try again.'
      this.render()
    }
  }

  private render() {
    const style = document.createElement('style')
    style.textContent = STYLES
    this.shadow.innerHTML = ''
    this.shadow.appendChild(style)

    const container = document.createElement('div')
    container.className = 'ceq-container'

    if (this.state === 'loading') {
      container.innerHTML = '<div class="ceq-loading">Loading...</div>'
    } else if (this.state === 'error') {
      container.innerHTML = `
        <div class="ceq-title">Spin & Win!</div>
        <div class="ceq-error">${this.errorMessage}</div>
      `
    } else if (this.state === 'already-played') {
      container.innerHTML = `
        <div class="ceq-title">You Already Played!</div>
        <div class="ceq-result">
          <div class="ceq-result-title">Your Prize:</div>
          <div class="ceq-result-prize">${this.reward?.label ?? 'Unknown'}</div>
        </div>
      `
    } else if (this.state === 'ready' || this.state === 'spinning' || this.state === 'done') {
      const title = document.createElement('div')
      title.className = 'ceq-title'
      title.textContent = 'Spin & Win!'
      container.appendChild(title)

      const subtitle = document.createElement('div')
      subtitle.className = 'ceq-subtitle'
      subtitle.textContent = 'Tap SPIN to reveal your reward'
      container.appendChild(subtitle)

      const wrapper = document.createElement('div')
      wrapper.className = 'ceq-wheel-wrapper'

      const pointer = document.createElement('div')
      pointer.className = 'ceq-pointer'
      wrapper.appendChild(pointer)

      this.canvas = document.createElement('canvas')
      this.canvas.width = 280
      this.canvas.height = 280
      wrapper.appendChild(this.canvas)

      const spinBtn = document.createElement('button')
      spinBtn.className = 'ceq-spin-btn'
      spinBtn.textContent = this.state === 'done' ? '\u2713' : 'SPIN'
      spinBtn.disabled = this.state !== 'ready'
      spinBtn.addEventListener('click', () => this.spin())
      wrapper.appendChild(spinBtn)

      container.appendChild(wrapper)

      if (this.state !== 'done') {
        const hint = document.createElement('div')
        hint.className = 'ceq-hint'
        hint.textContent = 'Tap SPIN to reveal your reward'
        container.appendChild(hint)
      }

      if (this.state === 'done') {
        const result = document.createElement('div')
        result.className = 'ceq-result'
        result.innerHTML = `
          <div class="ceq-result-title">Congratulations!</div>
          <div class="ceq-result-prize">${this.reward?.label ?? 'Unknown'}</div>
        `
        container.appendChild(result)
      }
    }

    this.shadow.appendChild(container)
  }

  private drawWheel(rotation: number) {
    if (!this.canvas) return
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return

    const cx = 140, cy = 140, r = 135
    ctx.clearRect(0, 0, 280, 280)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((rotation * Math.PI) / 180)

    // Equal-size segments — probability doesn't affect visual size
    let startAngle = -Math.PI / 2
    const sliceAngle = (2 * Math.PI) / this.segments.length

    for (const seg of this.segments) {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, r, startAngle, startAngle + sliceAngle)
      ctx.closePath()
      ctx.fillStyle = seg.color
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      ctx.save()
      ctx.rotate(startAngle + sliceAngle / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px Inter, system-ui, sans-serif'
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 2
      ctx.fillText(seg.label, r - 14, 4)
      ctx.restore()

      startAngle += sliceAngle
    }

    ctx.restore()
  }

  private spin() {
    if (this.state !== 'ready') return
    this.state = 'spinning'

    const spinBtn = this.shadow.querySelector('.ceq-spin-btn') as HTMLButtonElement
    if (spinBtn) {
      spinBtn.disabled = true
      spinBtn.textContent = '...'
    }

    // Calculate target angle for winning segment
    const sliceAngle = 360 / this.segments.length
    const targetAngle = -(this.winningIndex * sliceAngle + sliceAngle / 2)
    const totalRotation = 360 * 5 + targetAngle - (this.currentRotation % 360)

    const start = performance.now()
    const duration = 5000
    const startRot = this.currentRotation

    const animate = (ts: number) => {
      const elapsed = ts - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out quart
      const eased = 1 - Math.pow(1 - progress, 4)
      this.currentRotation = startRot + totalRotation * eased
      this.drawWheel(this.currentRotation)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        this.state = 'done'
        this.render()
        this.drawWheel(this.currentRotation)

        // Fire custom event
        this.dispatchEvent(
          new CustomEvent('ceq:reward-won', {
            bubbles: true,
            composed: true,
            detail: this.reward,
          }),
        )
      }
    }

    requestAnimationFrame(animate)
  }
}

customElements.define('ceq-spin-wheel', CeqSpinWheel)
