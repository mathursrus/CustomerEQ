'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'
import { Modal } from '@/components/ui/modal'

/* ---------- Types ---------- */

interface KBArticle {
  id: string
  title: string
  body: string
  category: string
  tags: string[]
  status: 'DRAFT' | 'PUBLISHED'
  embeddingGeneratedAt: string | null
  createdAt: string
  updatedAt: string
}

interface SearchResult {
  id: string
  title: string
  category: string
  score: number
  snippet: string
}

interface IntentResult {
  primary_intent: string
  confidence: number
  urgency: string
  reasoning: string
  suggested_article_ids: string[]
  suggested_response: string
}

/* ---------- Constants ---------- */

const CATEGORIES = [
  'FAQ',
  'POLICY',
  'TROUBLESHOOTING',
  'PRODUCT_GUIDE',
  'PROCESS',
  'OTHER',
] as const

const CATEGORY_LABELS: Record<string, string> = {
  FAQ: 'FAQ',
  POLICY: 'Policy',
  TROUBLESHOOTING: 'Troubleshooting',
  PRODUCT_GUIDE: 'Product Guide',
  PROCESS: 'Process',
  OTHER: 'Other',
}

const TAG_COLORS: Record<string, string> = {
  billing: 'bg-amber-100 text-amber-800',
  shipping: 'bg-blue-100 text-blue-800',
  returns: 'bg-pink-100 text-pink-800',
  account: 'bg-indigo-100 text-indigo-800',
  product: 'bg-emerald-100 text-emerald-800',
}

const DEFAULT_TAG_COLOR = 'bg-gray-100 text-gray-600'

/* ---------- Helpers ---------- */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

/* ---------- Sub-components ---------- */

function TagBadge({ tag }: { tag: string }) {
  const color = TAG_COLORS[tag.toLowerCase()] ?? DEFAULT_TAG_COLOR
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold mr-1 mb-0.5 ${color}`}
    >
      {tag}
    </span>
  )
}

function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')

  function addTag() {
    const trimmed = input.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${TAG_COLORS[t] ?? DEFAULT_TAG_COLOR}`}
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="ml-0.5 hover:text-red-600"
              aria-label={`Remove tag ${t}`}
            >
              x
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addTag()
          }
        }}
        placeholder="Add a tag..."
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  )
}

/* ---------- Main Page ---------- */

type View = 'list' | 'editor' | 'search'

export default function KnowledgeBasePage() {
  const { getToken } = useAuth()

  const [view, setView] = useState<View>('list')
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [totalArticles, setTotalArticles] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // Editor
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null)
  const [editorTitle, setEditorTitle] = useState('')
  const [editorBody, setEditorBody] = useState('')
  const [editorCategory, setEditorCategory] = useState<string>('FAQ')
  const [editorTags, setEditorTags] = useState<string[]>([])
  const [editorStatus, setEditorStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [saving, setSaving] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<KBArticle | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Semantic search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchLatency, setSearchLatency] = useState<number | null>(null)

  // Intent classification
  const [intentText, setIntentText] = useState('')
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null)
  const [classifying, setClassifying] = useState(false)

  /* ---------- API helpers ---------- */

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken()
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }, [getToken])

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await authHeaders()
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      if (filterStatus) params.set('status', filterStatus)
      params.set('pageSize', '100')
      const res = await fetch(`${API_URL}/v1/kb/articles?${params}`, { headers })
      if (res.ok) {
        const json = await res.json()
        setArticles(json.data ?? [])
        setTotalArticles(json.total ?? 0)
      }
    } catch {
      /* network error */
    } finally {
      setLoading(false)
    }
  }, [authHeaders, filterCategory, filterStatus])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  /* ---------- CRUD ---------- */

  function openCreateEditor() {
    setEditingArticle(null)
    setEditorTitle('')
    setEditorBody('')
    setEditorCategory('FAQ')
    setEditorTags([])
    setEditorStatus('DRAFT')
    setView('editor')
  }

  function openEditEditor(article: KBArticle) {
    setEditingArticle(article)
    setEditorTitle(article.title)
    setEditorBody(article.body)
    setEditorCategory(article.category)
    setEditorTags([...article.tags])
    setEditorStatus(article.status)
    setView('editor')
  }

  async function saveArticle() {
    setSaving(true)
    try {
      const headers = await authHeaders()
      const payload = {
        title: editorTitle,
        body: editorBody,
        category: editorCategory,
        tags: editorTags,
        status: editorStatus,
      }
      const isUpdate = !!editingArticle
      const url = isUpdate
        ? `${API_URL}/v1/kb/articles/${editingArticle!.id}`
        : `${API_URL}/v1/kb/articles`
      const method = isUpdate ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) })
      if (res.ok) {
        setView('list')
        fetchArticles()
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteArticle() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/v1/kb/articles/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
      })
      if (res.ok || res.status === 204) {
        setDeleteTarget(null)
        fetchArticles()
      }
    } finally {
      setDeleting(false)
    }
  }

  /* ---------- Semantic search ---------- */

  async function runSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchLatency(null)
    const start = Date.now()
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_URL}/v1/kb/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
        { headers },
      )
      if (res.ok) {
        const json = await res.json()
        setSearchResults(json.data ?? [])
        setSearchLatency(Date.now() - start)
      }
    } finally {
      setSearching(false)
    }
  }

  /* ---------- Intent classification ---------- */

  async function runClassifyIntent() {
    if (!intentText.trim()) return
    setClassifying(true)
    setIntentResult(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/v1/classify-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: intentText }),
      })
      if (res.ok) {
        setIntentResult(await res.json())
      }
    } finally {
      setClassifying(false)
    }
  }

  /* ---------- Derived ---------- */

  const filteredArticles = filterSearch
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(filterSearch.toLowerCase()) ||
          a.tags.some((t) => t.toLowerCase().includes(filterSearch.toLowerCase())),
      )
    : articles

  const publishedCount = articles.filter((a) => a.status === 'PUBLISHED').length
  const draftCount = articles.filter((a) => a.status === 'DRAFT').length
  const embeddedCount = articles.filter((a) => a.embeddingGeneratedAt).length
  const pendingEmbeddings = articles.length - embeddedCount
  const uniqueCategories = new Set(articles.map((a) => a.category))

  /* ---------- Render ---------- */

  return (
    <div>
      {/* ===== LIST VIEW ===== */}
      {view === 'list' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage articles that power AI-assisted support responses
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateEditor}
              data-testid="create-article-btn"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              + Create Article
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Total Articles</div>
              <div className="text-2xl font-bold text-gray-900">{totalArticles}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {draftCount} drafts, {publishedCount} published
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Categories</div>
              <div className="text-2xl font-bold text-gray-900">{uniqueCategories.size}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {[...uniqueCategories].map((c) => CATEGORY_LABELS[c] ?? c).join(', ')}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Embeddings</div>
              <div className="text-2xl font-bold text-gray-900">{embeddedCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {pendingEmbeddings > 0
                  ? `${pendingEmbeddings} pending generation`
                  : 'All up to date'}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '...' : 'Ready'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Semantic search & intent classification
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b-2 border-gray-200 mb-6">
            <button
              type="button"
              className="px-4 py-2 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600 -mb-[2px]"
            >
              All Articles
            </button>
            <button
              type="button"
              onClick={() => setView('search')}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-[2px]"
            >
              Semantic Search
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 mb-5 items-center">
            <div className="relative flex-1 max-w-sm">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search articles by title or tag..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700 outline-none"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          {/* Articles table */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table data-testid="kb-articles-table" className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tags
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Embedding
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Updated
                  </th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      Loading articles...
                    </td>
                  </tr>
                ) : filteredArticles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      No articles found.{' '}
                      <button
                        type="button"
                        onClick={openCreateEditor}
                        className="text-indigo-600 hover:underline"
                      >
                        Create your first article
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50 group">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <button
                          type="button"
                          onClick={() => openEditEditor(article)}
                          className="hover:text-indigo-600 text-left"
                        >
                          {article.title}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-indigo-600">
                          {CATEGORY_LABELS[article.category] ?? article.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {article.tags.map((tag) => (
                          <TagBadge key={tag} tag={tag} />
                        ))}
                      </td>
                      <td className="px-6 py-4">
                        {article.status === 'PUBLISHED' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {article.embeddingGeneratedAt ? (
                          <span className="text-xs text-green-600 font-medium">Ready</span>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {timeAgo(article.updatedAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditEditor(article)}
                            className="rounded px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(article)}
                            className="rounded px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== EDITOR VIEW ===== */}
      {view === 'editor' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {editingArticle ? 'Edit Article' : 'Create Article'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Write a knowledge base article to power AI support responses
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('list')}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveArticle}
                disabled={saving || !editorTitle.trim() || !editorBody.trim()}
                data-testid="save-article-btn"
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Article'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="e.g., How to Request a Refund"
                  data-testid="article-title-input"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Body (Markdown)
                </label>
                <textarea
                  value={editorBody}
                  onChange={(e) => setEditorBody(e.target.value)}
                  placeholder="Write your article content in Markdown..."
                  data-testid="article-body-input"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm font-mono leading-relaxed outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  style={{ minHeight: 320, resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Article Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={editorCategory}
                      onChange={(e) => setEditorCategory(e.target.value)}
                      data-testid="article-category-select"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tags</label>
                    <TagInput tags={editorTags} onChange={setEditorTags} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editorStatus}
                      onChange={(e) =>
                        setEditorStatus(e.target.value as 'DRAFT' | 'PUBLISHED')
                      }
                      data-testid="article-status-select"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white outline-none"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                    </select>
                  </div>
                </div>
              </div>

              {editingArticle && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Embedding Status</h3>
                  {editingArticle.embeddingGeneratedAt ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-green-600 font-medium">
                          Embedding Generated
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 leading-relaxed">
                        Model: text-embedding-3-small
                        <br />
                        Last generated: {timeAgo(editingArticle.embeddingGeneratedAt)}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-amber-500 font-medium">
                      Pending -- will generate on save
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== SEMANTIC SEARCH VIEW ===== */}
      {view === 'search' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Semantic Search</h1>
              <p className="mt-1 text-sm text-gray-500">
                Test natural language search against your knowledge base
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView('list')}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to Articles
            </button>
          </div>

          <div className="flex gap-3 mb-6">
            <div className="relative flex-1 max-w-xl">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch()
                }}
                placeholder="Ask a question... e.g., 'how do I get my money back?'"
                data-testid="semantic-search-input"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="button"
              onClick={runSearch}
              disabled={searching || !searchQuery.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="text-sm text-gray-500 mb-4">
              {searchResults.length} results found
              {searchLatency !== null && ` in ${searchLatency}ms`}
            </div>
          )}

          <div className="space-y-3 mb-10">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">{result.title}</h3>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600">
                    {result.score.toFixed(2)} relevance
                  </span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed mb-2">{result.snippet}</p>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>{CATEGORY_LABELS[result.category] ?? result.category}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Intent Classification */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Intent Classification</h2>
            <p className="text-sm text-gray-500 mb-4">
              Test how the system classifies customer messages
            </p>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Customer Message
                </label>
                <textarea
                  value={intentText}
                  onChange={(e) => setIntentText(e.target.value)}
                  placeholder="e.g., I was charged twice for my last order and I need this fixed immediately"
                  data-testid="intent-text-input"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  style={{ minHeight: 60, resize: 'vertical' }}
                />
              </div>
              <button
                type="button"
                onClick={runClassifyIntent}
                disabled={classifying || !intentText.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 mb-4"
              >
                {classifying ? 'Classifying...' : 'Classify Intent'}
              </button>

              {intentResult && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Primary Intent
                    </div>
                    <div className="text-base font-semibold text-amber-600">
                      {intentResult.primary_intent}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Confidence
                    </div>
                    <div className="text-base font-semibold text-gray-900">
                      {intentResult.confidence.toFixed(2)}
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${intentResult.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Urgency
                    </div>
                    <div
                      className={`text-base font-semibold ${
                        intentResult.urgency === 'high'
                          ? 'text-red-600'
                          : intentResult.urgency === 'medium'
                            ? 'text-amber-600'
                            : 'text-green-600'
                      }`}
                    >
                      {intentResult.urgency}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Reasoning
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {intentResult.reasoning}
                    </div>
                  </div>
                  {intentResult.suggested_response && (
                    <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Suggested Response Outline
                      </div>
                      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {intentResult.suggested_response}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteTarget && (
        <Modal
          title="Delete Article"
          onClose={() => setDeleteTarget(null)}
          size="sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteArticle}
                disabled={deleting}
                data-testid="confirm-delete-btn"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold">
              &ldquo;{deleteTarget.title}&rdquo;
            </span>
            ? This action will soft-delete the article. It can be recovered by an
            administrator.
          </p>
        </Modal>
      )}
    </div>
  )
}
