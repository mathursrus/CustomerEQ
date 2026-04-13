// Acme Coffee — demo-quality frontend. No debug panels, no JSON, no API
// endpoint labels. Feels like a real indie coffee e-commerce site backed
// by CustomerEQ for loyalty, surveys, support, and CX.

const state = {
  sessionId: localStorage.getItem('acme-sid'),
  memberId: localStorage.getItem('acme-mid'),
  email: localStorage.getItem('acme-email'),
  firstName: localStorage.getItem('acme-fname'),
  cart: {},
  config: null,
}

// ── Boot ─────────────────────────────────────────────────────────────
async function boot() {
  state.config = await api('GET', '/api/config')
  renderCatalog()
  refreshUI()
  hookAuth()
  hookCart()
  hookRewards()
  hookKb()
  hookSupportChat()
  // If already signed in, load account
  if (state.sessionId) loadAccount()
}

function refreshUI() {
  const badge = $('points-badge')
  const btn = $('signin-btn')
  if (state.sessionId) {
    btn.textContent = state.firstName || 'Account'
    btn.onclick = () => scrollTo('account')
    badge.classList.remove('hidden')
  } else {
    btn.textContent = 'Sign In / Join'
    btn.onclick = () => showModal()
    badge.classList.add('hidden')
  }
}

// ── Auth ──────────────────────────────────────────────────────────────
function hookAuth() {
  $('signin-btn').addEventListener('click', () => state.sessionId ? scrollTo('account') : showModal())
  $('hero-join-btn').addEventListener('click', () => state.sessionId ? scrollTo('shop') : showModal())
  $('modal-close').addEventListener('click', hideModal)
  $('auth-submit').addEventListener('click', doSignup)
}

function showModal() { $('auth-modal').classList.remove('hidden') }
function hideModal() { $('auth-modal').classList.add('hidden'); $('auth-error').classList.add('hidden') }

async function doSignup() {
  const email = $('auth-email').value.trim()
  const firstName = $('auth-first').value.trim()
  const lastName = $('auth-last').value.trim()
  if (!email || !firstName) { showError('auth-error', 'Email and first name are required.'); return }

  $('auth-submit').disabled = true
  $('auth-submit').textContent = 'Creating account...'
  try {
    const res = await api('POST', '/api/signup', { email, firstName, lastName })
    if (res.error) { showError('auth-error', res.error); return }
    state.sessionId = res.sessionId
    state.memberId = res.memberId
    state.email = email
    state.firstName = firstName
    localStorage.setItem('acme-sid', res.sessionId)
    localStorage.setItem('acme-mid', res.memberId)
    localStorage.setItem('acme-email', email)
    localStorage.setItem('acme-fname', firstName)
    hideModal()
    refreshUI()
    loadAccount()
    window.dispatchEvent(new Event('acme-session-changed'))
    toast(`Welcome, ${firstName}! You're now earning Beans.`)
  } catch (err) {
    showError('auth-error', err.message)
  } finally {
    $('auth-submit').disabled = false
    $('auth-submit').textContent = 'Create Account'
  }
}

// ── Catalog & Cart ───────────────────────────────────────────────────
function renderCatalog() {
  $('catalog').innerHTML = state.config.catalog.map(p => `
    <div class="product-card">
      <h4>${p.name}</h4>
      <div class="category">${p.category}</div>
      <div class="price">$${(p.priceCents / 100).toFixed(2)}</div>
      <div class="add-row">
        <input type="number" min="0" value="0" data-sku="${p.sku}" />
        <button data-sku="${p.sku}">Add</button>
      </div>
    </div>
  `).join('')

  $('catalog').querySelectorAll('.add-row button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.sessionId) { showModal(); return }
      const sku = btn.dataset.sku
      const input = $('catalog').querySelector(`input[data-sku="${sku}"]`)
      const qty = parseInt(input.value, 10) || 0
      if (qty > 0) { state.cart[sku] = (state.cart[sku] ?? 0) + qty; input.value = 0; renderCart() }
    })
  })
}

function hookCart() {
  $('checkout-btn').addEventListener('click', doCheckout)
}

function renderCart() {
  const items = Object.entries(state.cart)
  const totalQty = items.reduce((s, [, q]) => s + q, 0)
  const totalCents = items.reduce((sum, [sku, qty]) => {
    const p = state.config.catalog.find(c => c.sku === sku)
    return sum + (p?.priceCents ?? 0) * qty
  }, 0)
  const bar = $('cart-bar')
  if (totalQty === 0) { bar.classList.add('hidden'); return }
  bar.classList.remove('hidden')
  $('cart-summary').textContent = `${totalQty} item${totalQty > 1 ? 's' : ''} — $${(totalCents / 100).toFixed(2)}`
}

async function doCheckout() {
  const items = Object.entries(state.cart).map(([sku, qty]) => ({ sku, qty }))
  if (items.length === 0) return
  $('checkout-btn').disabled = true
  $('checkout-btn').textContent = 'Processing...'
  try {
    const res = await api('POST', '/api/checkout', { items }, true)
    state.cart = {}
    renderCart()
    // Show post-checkout with thank-you + survey
    $('shop').classList.add('hidden')
    const postCheckout = $('post-checkout')
    postCheckout.classList.remove('hidden')
    $('order-detail').textContent = `Order #${res.orderId?.slice(-8)} — $${res.subtotal?.toFixed(2)}`
    $('earned-msg').textContent = `+50 Beans earned on this order!`
    // Embed the NPS survey
    const host = $('survey-host')
    if (state.config.npsSurveyId) {
      host.innerHTML = '<div id="customereq-survey"></div>'
      const script = document.createElement('script')
      script.src = `${state.config.apiUrl}/v1/public/surveys/${state.config.npsSurveyId}/widget.js`
      script.async = true
      host.appendChild(script)
    } else {
      host.innerHTML = '<p class="muted">Survey not configured.</p>'
    }
    scrollTo('post-checkout')
    // Refresh account in background
    setTimeout(() => loadAccount(), 1500)
  } catch (err) {
    toast('Checkout failed: ' + err.message)
  } finally {
    $('checkout-btn').disabled = false
    $('checkout-btn').textContent = 'Place Order'
  }
}

// ── Account / Rewards ────────────────────────────────────────────────
async function loadAccount() {
  if (!state.sessionId) return
  $('account').classList.remove('hidden')
  $('member-greeting').textContent = `${state.firstName} — ${state.email}`
  try {
    const data = await api('GET', '/api/account', null, true)
    if (data.error) return
    const pts = data.balance?.pointsBalance ?? 0
    $('balance-number').textContent = pts
    $('points-badge').textContent = `${pts} Beans`

    // Activity
    const events = data.profile?.recentEvents?.items ?? []
    const surveys = data.profile?.surveyResponses?.items ?? []
    const redemptions = data.profile?.redemptions?.items ?? []
    const conversations = data.profile?.openConversations ?? []
    const cases = data.profile?.openCases ?? []

    const actList = $('activity-list')
    const items = [
      ...events.map(e => ({ text: `${formatEvent(e.eventType)}`, pts: `+${e.pointsEarned}`, neg: false })),
      ...redemptions.map(r => ({ text: `Redeemed: ${r.reward?.name ?? 'Reward'}`, pts: `-${r.pointsSpent}`, neg: true })),
      ...surveys.map(s => ({ text: `Survey: score ${s.score ?? '—'}`, pts: '+50', neg: false })),
      ...conversations.map(c => ({ text: `Support: ${c.intent ?? 'conversation'}`, pts: '', neg: false })),
      ...cases.map(c => ({ text: `Case: ${c.status} (${c.priority})`, pts: '', neg: false })),
    ]
    actList.innerHTML = items.length === 0
      ? '<p class="muted">No activity yet. Make a purchase to get started!</p>'
      : items.slice(0, 10).map(i => `
        <div class="activity-item">
          <span>${esc(i.text)}</span>
          <span class="pts ${i.neg ? 'negative' : ''}">${i.pts ? i.pts + ' Beans' : ''}</span>
        </div>
      `).join('')
  } catch { /* ignore */ }
  loadRewards()
}

function hookRewards() {}

async function loadRewards() {
  try {
    const data = await api('GET', '/api/rewards')
    const rewards = data.rewards ?? data.data ?? []
    $('rewards-grid').innerHTML = rewards.length === 0
      ? '<p class="muted">No rewards available yet.</p>'
      : rewards.map(r => `
        <div class="reward-card">
          <h4>${esc(r.name)}</h4>
          <div class="desc">${esc(r.description ?? '')}</div>
          <div class="cost">${r.pointsCost} Beans</div>
          <button class="btn-redeem" data-id="${r.id}">Redeem</button>
        </div>
      `).join('')
    $('rewards-grid').querySelectorAll('.btn-redeem').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        btn.textContent = 'Redeeming...'
        try {
          await api('POST', '/api/redeem', { rewardId: btn.dataset.id }, true)
          toast('Redeemed! Check your email for details.')
          loadAccount()
        } catch (err) {
          toast('Redemption failed: ' + err.message)
        } finally {
          btn.disabled = false
          btn.textContent = 'Redeem'
        }
      })
    })
  } catch { /* ignore */ }
}

// ── KB Search ────────────────────────────────────────────────────────
function hookKb() {
  $('kb-search-btn').addEventListener('click', doKbSearch)
  $('kb-query').addEventListener('keydown', e => { if (e.key === 'Enter') doKbSearch() })
}

async function doKbSearch() {
  const query = $('kb-query').value.trim()
  if (!query) return
  const root = $('kb-results')
  root.innerHTML = '<p class="muted">Searching...</p>'
  try {
    const data = await api('POST', '/api/help/search', { query })
    if (data.error) { root.innerHTML = `<p class="muted">${esc(data.error)}</p>`; return }
    const summary = data.summaryResponse || data.summary || ''
    const results = data.results ?? []
    root.innerHTML = `
      ${summary ? `<div class="answer"><strong>AI Answer:</strong><br>${esc(summary)}</div>` : ''}
      ${results.map(r => `<div class="article"><strong>${esc(r.title ?? 'Article')}</strong>${esc((r.excerpt ?? r.body ?? '').slice(0, 200))}...</div>`).join('')}
      ${!summary && results.length === 0 ? '<p class="muted">No results found. Try a different question or chat with support (bottom right).</p>' : ''}
    `
  } catch {
    root.innerHTML = '<p class="muted">Search unavailable. Try chatting with support instead (bottom right).</p>'
  }
}

// ── Support chat ─────────────────────────────────────────────────────
function hookSupportChat() {
  const chat = $('acme-chat')
  if (!chat) return
  chat.setAttribute('api-base', state.config.apiUrl)
  chat.setAttribute('brand-id', state.config.brandId ?? '')
  if (state.email) chat.setAttribute('token', state.email)
  window.addEventListener('acme-session-changed', () => {
    if (state.email) chat.setAttribute('token', state.email)
  })
}

// ── Helpers ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)

async function api(method, path, body, auth) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && state.sessionId) headers['X-Acme-Session'] = state.sessionId
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return res.json()
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function toast(msg) {
  const el = $('toast')
  el.textContent = msg
  el.classList.remove('hidden')
  setTimeout(() => el.classList.add('hidden'), 3500)
}

function showError(id, msg) {
  const el = $(id)
  el.textContent = msg
  el.classList.remove('hidden')
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function formatEvent(type) {
  const map = { purchase: 'Purchase', 'cx.survey_completed': 'Survey bonus', campaign_award: 'Campaign bonus', support_apology_points: 'Support recovery' }
  return map[type] ?? type
}

boot()
