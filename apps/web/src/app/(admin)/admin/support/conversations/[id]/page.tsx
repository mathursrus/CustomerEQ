'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

/* ─── Types ────────────────────────────────────────────────────────────── */

interface Message {
  id: string
  role: 'CUSTOMER' | 'AI' | 'AGENT'
  content: string
  createdAt: string
}

interface ConversationDetail {
  id: string
  status: string
  intent: string | null
  confidence: number | null
  topic: string | null
  summary: string | null
  assignee: string | null
  rulesMatched: string[]
  member: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    pointsBalance: number | null
    currentTier: string | null
  }
  messages: Message[]
  createdAt: string
  resolvedAt: string | null
  closedAt: string | null
  escalatedAt: string | null
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  WAITING_ON_CUSTOMER: 'bg-yellow-100 text-yellow-700',
  ESCALATED: 'bg-red-100 text-red-700',
  RESOLVED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-gray-100 text-gray-700',
}

const roleStyles: Record<string, { label: string; bg: string; align: string }> = {
  CUSTOMER: { label: 'Customer', bg: 'bg-gray-100', align: 'items-start' },
  AI: { label: 'AI Bot', bg: 'bg-indigo-50', align: 'items-start' },
  AGENT: { label: 'Agent', bg: 'bg-blue-50', align: 'items-end' },
}

/* ─── Component ────────────────────────────────────────────────────────── */

export default function ConversationDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { getToken } = useAuth()
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadConversation = useCallback(async () => {
    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/support/conversations/${id}`, {
        cache: 'no-store',
        headers,
      })
      if (!res.ok) return
      const data = await res.json()
      setConversation(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [getToken, id])

  useEffect(() => {
    loadConversation()
  }, [loadConversation])

  async function sendReply() {
    if (!replyText.trim()) return
    setSending(true)
    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_URL}/v1/support/conversations/${id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: replyText }),
      })
      if (res.ok) {
        setReplyText('')
        await loadConversation()
      }
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  async function updateStatus(newStatus: string) {
    setUpdatingStatus(true)
    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_URL}/v1/support/conversations/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await loadConversation()
      }
    } catch {
      // ignore
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Conversation not found.</p>
        <Link href="/admin/support/conversations" className="mt-2 text-sm text-indigo-600 hover:underline">
          Back to conversations
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/admin/support/conversations"
          className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          &larr; Back to Conversations
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Conversation with {conversation.member.firstName ?? ''} {conversation.member.lastName ?? ''}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Message Thread */}
        <div className="lg:col-span-2 space-y-4">
          {/* Messages */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Messages</h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {conversation.messages.map((msg) => {
                const style = roleStyles[msg.role] ?? roleStyles.CUSTOMER
                return (
                  <div key={msg.id} className={`flex flex-col ${style.align}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-3 ${style.bg}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-600">{style.label}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                )
              })}
              {conversation.messages.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No messages yet.</p>
              )}
            </div>

            {/* Reply Box */}
            {conversation.status !== 'CLOSED' && conversation.status !== 'RESOLVED' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                  placeholder="Type a reply as an agent..."
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !replyText.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            )}
          </div>

          {/* Status Actions */}
          <div className="flex flex-wrap gap-3">
            {conversation.status === 'ACTIVE' && (
              <button
                onClick={() => updateStatus('ESCALATED')}
                disabled={updatingStatus}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                Escalate
              </button>
            )}
            {conversation.status !== 'RESOLVED' && conversation.status !== 'CLOSED' && (
              <button
                onClick={() => updateStatus('RESOLVED')}
                disabled={updatingStatus}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                Mark Resolved
              </button>
            )}
            {conversation.status !== 'CLOSED' && (
              <button
                onClick={() => updateStatus('CLOSED')}
                disabled={updatingStatus}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Right: Conversation Metadata */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      statusColors[conversation.status] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {conversation.status.replace(/_/g, ' ')}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Intent</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {conversation.intent ?? '—'}
                  {conversation.confidence != null && (
                    <span className="ml-1 text-xs text-gray-400">
                      ({Math.round(conversation.confidence * 100)}%)
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Topic</dt>
                <dd className="mt-1 text-sm text-gray-900">{conversation.topic ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</dt>
                <dd className="mt-1 text-sm text-gray-900">{conversation.assignee ?? 'Unassigned'}</dd>
              </div>
              {conversation.summary && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</dt>
                  <dd className="mt-1 text-sm text-gray-700">{conversation.summary}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(conversation.createdAt).toLocaleString()}
                </dd>
              </div>
              {conversation.escalatedAt && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Escalated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(conversation.escalatedAt).toLocaleString()}
                  </dd>
                </div>
              )}
              {conversation.resolvedAt && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolved</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(conversation.resolvedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Member Info Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Member</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {conversation.member.firstName ?? ''} {conversation.member.lastName ?? ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{conversation.member.email}</dd>
              </div>
              {conversation.member.currentTier && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</dt>
                  <dd className="mt-1 text-sm text-gray-900">{conversation.member.currentTier}</dd>
                </div>
              )}
              {conversation.member.pointsBalance != null && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {conversation.member.pointsBalance.toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
