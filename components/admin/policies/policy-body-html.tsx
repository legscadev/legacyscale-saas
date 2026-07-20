// Read-view renderer for stored policy body HTML. Uses the same
// .tiptap selector conventions the editor writes to so paragraphs,
// headings, lists, blockquotes, and links look continuous between
// edit and read modes.
//
// dangerouslySetInnerHTML is safe here because the HTML string is
// produced by Tiptap's getHTML() (schema-escaped) and stored back
// unchanged. Writer + reader are both admins today; when this
// surfaces to non-admins (Phase 7 member view) add a DOMPurify
// boundary.

import { cn } from '@/lib/utils'

interface PolicyBodyHtmlProps {
  html: string | null | undefined
  className?: string
}

export function PolicyBodyHtml({ html, className }: PolicyBodyHtmlProps) {
  if (!html || html.trim() === '' || html.trim() === '<p></p>') {
    return (
      <p className={cn('text-sm italic text-muted-foreground', className)}>
        This policy has no content yet.
      </p>
    )
  }

  return (
    <div
      className={cn(
        'tiptap text-sm text-foreground',
        '[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mt-6 [&_h1]:mb-3',
        '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-5 [&_h2]:mb-2',
        '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mt-4 [&_h3]:mb-2',
        '[&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc',
        '[&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal',
        '[&_li]:my-1',
        '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold [&_em]:italic',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
