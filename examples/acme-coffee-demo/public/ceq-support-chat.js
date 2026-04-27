(function(){"use strict";const d=`
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
`,o=class o extends HTMLElement{constructor(){super(),this.state="closed",this.conversationId=null,this.messages=[],this.eventSource=null,this.isLoading=!1,this.shadow=this.attachShadow({mode:"open"})}get brandId(){return this.getAttribute("brand-id")??""}get token(){return this.getAttribute("token")??""}get apiBase(){return this.getAttribute("api-base")??""}connectedCallback(){this.render()}disconnectedCallback(){this.eventSource?.close()}render(t=!1){this.shadow.innerHTML=`
      <style>${d}</style>
      <div class="ceq-panel ${this.state==="closed"?"":"open"}" id="panel">
        <div class="ceq-header">
          <h3>Support Chat</h3>
          <button class="ceq-close" id="close-btn" aria-label="Close chat">&times;</button>
        </div>
        <div class="ceq-messages" id="messages" aria-live="polite" role="log">
          ${this.messages.map(e=>`
            <div class="ceq-msg ${e.role.toLowerCase()}">${this.escapeHtml(e.content)}</div>
          `).join("")}
          ${this.isLoading?'<div class="ceq-typing" aria-label="Agent is typing"><span>.</span><span>.</span><span>.</span></div>':""}
        </div>
        ${this.state==="error"?'<div class="ceq-error">Something went wrong. Please try again.</div>':""}
        <div class="ceq-input-area">
          <input type="text" class="ceq-input" id="msg-input" placeholder="Type a message..." ${this.isLoading?"disabled":""}>
          <button class="ceq-send" id="send-btn" ${this.isLoading?"disabled":""}>Send</button>
        </div>
      </div>
      <button class="ceq-launcher ${this.state!=="closed"?"hidden":""}" id="launcher" aria-label="Open support chat" style="${this.state!=="closed"?"display:none":""}">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
      </button>
    `,this.shadow.getElementById("launcher")?.addEventListener("click",()=>this.open()),this.shadow.getElementById("close-btn")?.addEventListener("click",()=>this.close()),this.shadow.getElementById("send-btn")?.addEventListener("click",()=>this.handleSend()),this.shadow.getElementById("msg-input")?.addEventListener("keydown",e=>{e.key==="Enter"&&this.handleSend(),e.key==="Escape"&&this.close()}),t&&this.scrollToBottom()}open(){this.state="open",this.render(),this.dispatchEvent(new CustomEvent("ceq:chat-opened",{bubbles:!0})),setTimeout(()=>{this.shadow.getElementById("msg-input")?.focus()},100)}close(){this.state="closed",this.render(),this.dispatchEvent(new CustomEvent("ceq:chat-closed",{bubbles:!0}))}async handleSend(){const e=this.shadow.getElementById("msg-input")?.value.trim();if(!(!e||this.isLoading)){this.messages.push({role:"CUSTOMER",content:e,timestamp:new Date().toISOString()}),this.isLoading=!0,this.render(!0);try{this.conversationId?await this.sendMessage(e):await this.startConversation(e),this.dispatchEvent(new CustomEvent("ceq:message-sent",{bubbles:!0,detail:{conversationId:this.conversationId}}))}catch{this.state="error",this.isLoading=!1,this.render()}}}async startConversation(t){const e=await fetch(`${this.apiBase}/v1/public/support/conversations`,{method:"POST",headers:{Authorization:`Bearer ${this.token}`,"Content-Type":"application/json"},body:JSON.stringify({memberEmail:this.token,initialMessage:t})});if(!e.ok)throw new Error(`Failed to create conversation: ${e.status}`);const n=await e.json();this.conversationId=n.conversationId,this.connectSSE(n.streamUrl),this.pollForResponse()}connectSSE(t){const e=`${this.apiBase}${t}?token=${encodeURIComponent(this.token)}`;this.eventSource=new EventSource(e),this.eventSource.onmessage=n=>{try{const s=JSON.parse(n.data);s.type==="message"?(this.messages.push({role:s.role,content:s.content,timestamp:new Date().toISOString()}),this.isLoading=!1,this.render(!0),this.dispatchEvent(new CustomEvent("ceq:message-received",{bubbles:!0,detail:{conversationId:this.conversationId,role:s.role}}))):s.type==="status"&&s.status==="ESCALATED"&&this.dispatchEvent(new CustomEvent("ceq:escalated",{bubbles:!0,detail:{conversationId:this.conversationId,assignee:s.assignee}}))}catch{}},this.eventSource.onerror=()=>{this.eventSource?.close(),this.eventSource=null}}async pollForResponse(){for(let n=0;n<30;n++){if(await new Promise(s=>setTimeout(s,2e3)),!this.isLoading)return;try{const s=await fetch(`${this.apiBase}/v1/public/support/conversations/${this.conversationId}/messages`,{headers:{Authorization:`Bearer ${this.token}`}});if(!s.ok)continue;const r=(await s.json()).messages.filter(i=>i.role!=="CUSTOMER"&&!this.messages.some(c=>c.content===i.content&&c.role===i.role));if(r.length>0){for(const i of r)this.messages.push({role:i.role,content:i.content,timestamp:i.createdAt});this.isLoading=!1,this.render(!0),this.dispatchEvent(new CustomEvent("ceq:message-received",{bubbles:!0,detail:{conversationId:this.conversationId,role:r[0].role}}));return}}catch{}}this.isLoading=!1,this.render()}async sendMessage(t){const e=await fetch(`${this.apiBase}/v1/public/support/conversations/${this.conversationId}/messages`,{method:"POST",headers:{Authorization:`Bearer ${this.token}`,"Content-Type":"application/json"},body:JSON.stringify({content:t})});if(!e.ok)throw new Error(`Failed to send message: ${e.status}`);this.pollForResponse()}escapeHtml(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}scrollToBottom(){const t=this.shadow.getElementById("messages");t&&(t.scrollTop=t.scrollHeight)}};o.observedAttributes=["brand-id","token","api-base"];let a=o;customElements.define("ceq-support-chat",a)})();
