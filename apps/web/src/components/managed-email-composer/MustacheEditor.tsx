'use client'

// Issue #420 R27 — TipTap-based rich-text composer for the managed-email body.
// Replaces the V0 <textarea> per reviewer r3292385788. Three responsibilities:
//
// 1. Rich-text editing (StarterKit: paragraphs, bold/italic, lists, headings).
// 2. Link support (operator paste / Cmd-K).
// 3. {{mustache_token}} insertion via the @tiptap/extension-mention plugin.
//    Operator types `{{`, a popover lists MUSTACHE_TOKENS, picking one inserts
//    a non-editable chip that serializes back to the literal `{{token_id}}`
//    string in getHTML() output — that's what the backend renderTemplate.ts
//    expects to find at dispatch time.
//
// Why the chip-with-text-renderHTML shape: TipTap's mention node lives in the
// editor as a self-contained atom (operator can't half-delete it), but the
// HTML it serializes is the plain mustache string. The backend then does its
// own substitution and never has to know the editor produced a chip.

import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, ReactRenderer, useEditor, type Editor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  MustacheSuggestionList,
  type MustacheSuggestionListHandle,
  filterMustacheTokens,
} from './MustacheSuggestionList'

export interface MustacheEditorProps {
  /** Current body value (HTML). The component is fully controlled. */
  value: string
  /** Called on every editor change with the serialized HTML. */
  onChange: (html: string) => void
  /** Aria-label for the editor surface. */
  ariaLabel?: string
  /** Optional id to associate with an external <label>. */
  id?: string
}

interface SuggestionAnchor {
  top: number
  left: number
}

export function MustacheEditor({
  value,
  onChange,
  ariaLabel = 'Email body',
  id,
}: MustacheEditorProps) {
  // Suggestion-popover state lives in React (not TipTap) so the popover
  // renders inside the same DOM tree as the rest of the page — cleaner for
  // RTL tests + bounded by the page's stacking context.
  const [suggestionAnchor, setSuggestionAnchor] = useState<SuggestionAnchor | null>(null)
  const [suggestionItems, setSuggestionItems] = useState<ReturnType<typeof filterMustacheTokens>>([])
  const suggestionCommandRef = useRef<((token: { id: string; label: string }) => void) | null>(null)
  const suggestionListRef = useRef<MustacheSuggestionListHandle | null>(null)

  // ReactRenderer instance shared across the suggestion-plugin lifecycle
  // callbacks. useRef gives it a stable identity that survives renders and
  // is correctly captured by the closures inside useEditor's config (which
  // only runs once per editor instance).
  const listRendererRef = useRef<ReactRenderer<MustacheSuggestionListHandle> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Headings up to H3; H4+ aren't useful for email bodies.
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
      }),
      Mention.extend({
        // Serialize the mention node as the literal `{{id}}` string in
        // getHTML() output — the backend renderTemplate.ts substitutes from
        // there. Without this override, getHTML() would emit
        // `<span data-type="mention" ...>` markup the backend wouldn't
        // recognize as a mustache.
        renderHTML({ node }) {
          return ['span', { 'data-mustache': node.attrs.id }, `{{${node.attrs.id}}}`]
        },
        renderText({ node }) {
          return `{{${node.attrs.id}}}`
        },
      }).configure({
        HTMLAttributes: {
          class: 'mustache-chip',
        },
        suggestion: {
          char: '{{',
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }) => filterMustacheTokens(query),
          render: () => ({
            onStart: (props) => {
              suggestionCommandRef.current = props.command
              setSuggestionItems(props.items as ReturnType<typeof filterMustacheTokens>)
              const rect = props.clientRect?.()
              if (rect) {
                setSuggestionAnchor({ top: rect.bottom, left: rect.left })
              }
              listRendererRef.current = new ReactRenderer(MustacheSuggestionList, {
                props: {
                  items: props.items as ReturnType<typeof filterMustacheTokens>,
                  command: props.command,
                },
                editor: props.editor,
              })
              suggestionListRef.current =
                (listRendererRef.current.ref as MustacheSuggestionListHandle | null) ?? null
            },
            onUpdate: (props) => {
              setSuggestionItems(props.items as ReturnType<typeof filterMustacheTokens>)
              suggestionCommandRef.current = props.command
              const rect = props.clientRect?.()
              if (rect) {
                setSuggestionAnchor({ top: rect.bottom, left: rect.left })
              }
              listRendererRef.current?.updateProps({
                items: props.items,
                command: props.command,
              })
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                setSuggestionAnchor(null)
                listRendererRef.current?.destroy()
                listRendererRef.current = null
                return true
              }
              return suggestionListRef.current?.onKeyDown(props) ?? false
            },
            onExit: () => {
              setSuggestionAnchor(null)
              listRendererRef.current?.destroy()
              listRendererRef.current = null
              suggestionListRef.current = null
            },
          }),
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        ...(id ? { id } : {}),
        class:
          'tiptap-managed-email-body min-h-[180px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
    immediatelyRender: false,
  })

  // Sync external value -> editor when the parent changes value
  // (e.g., DEFAULT_BODY seeded on survey load) without breaking the
  // editor's own internal state during regular typing. `editor` is omitted
  // from the dep array on purpose: depending on it would loop, since
  // setContent itself triggers onUpdate which triggers the parent's
  // onChange which can pass a new `value` back in. Linter rule guard:
  // react-hooks/exhaustive-deps isn't loaded in this repo's eslint config,
  // so no disable comment is needed.
  useEffect(() => {
    if (!editor) return
    const currentHtml = editor.getHTML()
    if (currentHtml !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  const insertToken = useCallback(
    (id: string) => {
      if (!editor) return
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'mention',
          attrs: { id },
        })
        .insertContent(' ')
        .run()
    },
    [editor],
  )

  if (!editor) {
    return (
      <div className="min-h-[180px] w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
        Loading editor…
      </div>
    )
  }

  return (
    <div className="relative">
      <ToolbarRow editor={editor} onInsertToken={insertToken} />
      <EditorContent editor={editor} />
      {suggestionAnchor && suggestionItems.length > 0 ? (
        <div
          className="absolute z-50"
          style={{ top: suggestionAnchor.top - editor.view.dom.getBoundingClientRect().top + 8, left: 0 }}
        >
          <MustacheSuggestionList
            ref={suggestionListRef}
            items={suggestionItems}
            command={(token) => suggestionCommandRef.current?.(token)}
          />
        </div>
      ) : null}
    </div>
  )
}

function ToolbarRow({
  editor,
  onInsertToken,
}: {
  editor: Editor
  onInsertToken: (id: string) => void
}) {
  // Minimal toolbar — bold / italic / bullet list / link + an "Insert token"
  // affordance so operators don't have to remember the `{{` trigger. The
  // token list mirrors MUSTACHE_TOKENS exactly so a new palette entry is a
  // one-place edit.
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        label="Link"
        active={editor.isActive('link')}
        onClick={() => {
          const prevUrl = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('Link URL', prevUrl ?? 'https://')
          if (url === null) return
          if (url === '') {
            editor.chain().focus().unsetLink().run()
            return
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }}
      >
        🔗
      </ToolbarButton>
      <span className="mx-2 h-4 w-px bg-gray-300" aria-hidden="true" />
      <InsertTokenMenu onInsert={onInsertToken} />
    </div>
  )
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}

function InsertTokenMenu({ onInsert }: { onInsert: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-white"
      >
        Insert token ▾
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Mustache token palette (toolbar)"
          className="absolute left-0 top-full z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg"
        >
          {filterMustacheTokens('').map((token) => (
            <button
              key={token.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onInsert(token.id)
                setOpen(false)
              }}
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-indigo-50"
            >
              <span className="font-mono text-indigo-700">{`{{${token.id}}}`}</span>
              {token.required ? (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                  REQUIRED
                </span>
              ) : null}
              <span className="ml-2 text-gray-500">{token.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
