'use client'

import { useCallback, useEffect } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Unlink,
} from 'lucide-react'

import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string | null
  onChange: (html: string) => void
  placeholder?: string
  /** Render in a more compact size — used inside dialogs. */
  size?: 'default' | 'sm'
  /** Disable editing entirely. */
  disabled?: boolean
  /** Style hook for the editor wrapper (border, max-height, etc.). */
  className?: string
  /** Id for label association. */
  id?: string
  /** ARIA labelling for screen readers. */
  ariaLabel?: string
}

/**
 * TipTap-backed rich text editor that stores HTML in the bound
 * `value`. The toolbar exposes a focused set of marks/nodes — bold,
 * italic, strikethrough, two heading levels, two list types,
 * blockquote, and link/unlink. Anything richer (images, tables,
 * embeds) is intentionally out of scope; admins paste media as
 * separate lesson types instead.
 *
 * Stored content is HTML produced by TipTap's `getHTML()`, which is
 * already escaped/structured. Renderers (member-side later) should
 * still sanitize at the DOM boundary as a defense-in-depth measure.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  size = 'default',
  disabled = false,
  className,
  id,
  ariaLabel,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // Heading is included; restrict to h2/h3 — h1 is the page
        // title in every admin surface.
        heading: { levels: [2, 3] },
        // Drop hardBreak — not useful for descriptions and just
        // bloats output with empty <br> on paste.
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
          class: 'text-primary underline underline-offset-2',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Start typing…',
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:text-muted-foreground/60 before:float-left before:pointer-events-none before:h-0',
      }),
    ],
    content: value ?? '',
    onUpdate: ({ editor: ed }) => {
      // Empty doc → empty string (don't store "<p></p>" noise that
      // would pollute isDirty comparisons).
      const html = ed.isEmpty ? '' : ed.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        // Typography is hand-rolled (no @tailwindcss/typography
        // plugin in this repo). The `.tiptap` selector lets us
        // target nested elements via globals.css if more styling
        // ever becomes warranted.
        class: cn(
          'tiptap focus:outline-none text-sm',
          '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
          '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-3 [&_h2]:mb-1',
          '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mt-3 [&_h3]:mb-1',
          '[&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc',
          '[&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal',
          '[&_li]:my-0.5',
          '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
          '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
          '[&_strong]:font-semibold [&_em]:italic',
          size === 'sm' ? 'min-h-20' : 'min-h-32',
          'px-3 py-2',
        ),
        ...(id ? { id } : {}),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
  })

  // Sync external `value` changes back into the editor (e.g. when the
  // builder resets local state on discard). Only set content when it
  // diverges to avoid wiping the user's cursor mid-type.
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    const next = value ?? ''
    if (current === next) return
    editor.commands.setContent(next, { emitUpdate: false })
  }, [value, editor])

  // Keep `editable` in sync if the parent toggles disabled.
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  if (!editor) {
    // SSR: render a stable placeholder so the layout doesn't jump on
    // hydration. The actual editor takes over once mounted.
    return (
      <div
        className={cn(
          'rounded-md border border-input bg-background',
          className,
        )}
      >
        <div className="border-b px-2 py-1.5" />
        <div className={cn(size === 'sm' ? 'min-h-20' : 'min-h-32', 'px-3 py-2')} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/30',
        disabled && 'opacity-60',
        className,
      )}
    >
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  )
}

// =====================================================================
// TOOLBAR
// =====================================================================

interface ToolbarProps {
  editor: Editor
  disabled: boolean
}

function Toolbar({ editor, disabled }: ToolbarProps) {
  const onAddLink = useCallback(() => {
    const previous = editor.getAttributes('link').href as string | undefined
    const input = window.prompt('Link URL', previous ?? 'https://')
    if (input === null) return
    const url = input.trim()
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run()
  }, [editor])

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
      <ToolbarButton
        icon={Bold}
        label="Bold"
        active={editor.isActive('bold')}
        disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label="Italic"
        active={editor.isActive('italic')}
        disabled={disabled || !editor.can().chain().focus().toggleItalic().run()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label="Strikethrough"
        active={editor.isActive('strike')}
        disabled={disabled || !editor.can().chain().focus().toggleStrike().run()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <Separator />
      <ToolbarButton
        icon={Heading2}
        label="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        disabled={disabled}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      />
      <ToolbarButton
        icon={Heading3}
        label="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        disabled={disabled}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      />
      <Separator />
      <ToolbarButton
        icon={List}
        label="Bullet list"
        active={editor.isActive('bulletList')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        label="Numbered list"
        active={editor.isActive('orderedList')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={Quote}
        label="Quote"
        active={editor.isActive('blockquote')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <Separator />
      <ToolbarButton
        icon={LinkIcon}
        label="Add or edit link"
        active={editor.isActive('link')}
        disabled={disabled}
        onClick={onAddLink}
      />
      {editor.isActive('link') ? (
        <ToolbarButton
          icon={Unlink}
          label="Remove link"
          disabled={disabled}
          onClick={() => editor.chain().focus().unsetLink().run()}
        />
      ) : null}
    </div>
  )
}

interface ToolbarButtonProps {
  icon: typeof Bold
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-muted text-foreground',
      )}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

function Separator() {
  return <div className="mx-0.5 h-4 w-px bg-border" />
}
