'use client'

// Print view for /admin/policies/[id]/print. Uses a classic CSS
// visibility trick so the browser's print dialog only rasterizes
// the .policy-print container — the AppShell chrome (sidebar,
// top-bar) stays visible on screen but disappears from the printed
// output. Keeps auth + tenancy through the admin layout without
// building a separate route group.

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { fmtCalendarDate } from '@/lib/format'

import type { PolicyDetailPayload } from '@/app/(admin)/admin/policies/actions'

import { PolicyBodyHtml } from './policy-body-html'
import { CategoryChip, RevisionBadge } from './policy-pills'

interface PolicyPrintViewProps {
  data: PolicyDetailPayload
  companyName: string | null
  basePath?: string
}

// Injected once at the top of the tree. `visibility: hidden` on the
// body then re-enabled on our container is the safest way to strip
// arbitrary parent chrome without touching AppShell — `display:
// none` would collapse layout in unexpected ways.
const PRINT_CSS = `
@media print {
  body * {
    visibility: hidden !important;
  }
  .policy-print,
  .policy-print * {
    visibility: visible !important;
  }
  .policy-print {
    position: absolute !important;
    inset: 0 !important;
    padding: 24px 32px !important;
    background: white !important;
    color: black !important;
    font-size: 12pt !important;
    line-height: 1.5 !important;
  }
  .no-print {
    display: none !important;
  }
  /* Widow / orphan control for the body */
  .policy-print p, .policy-print li {
    orphans: 3;
    widows: 3;
  }
  .policy-print h1, .policy-print h2, .policy-print h3 {
    page-break-after: avoid;
  }
}
`

export function PolicyPrintView({
  data,
  companyName,
  basePath = '/admin/policies',
}: PolicyPrintViewProps) {
  const { policy } = data

  return (
    <>
      {/* Style tag lives in the render so the browser picks it up
          before any print keyboard shortcut. */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* No-print action bar on screen only */}
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`${basePath}/${policy.id}`}>
              <ArrowLeft className="size-4" />
              Back to policy
            </Link>
          }
        />
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print now
        </Button>
      </div>

      <article className="policy-print mx-auto max-w-3xl space-y-6 rounded-lg border bg-card p-8 shadow-xs">
        <header className="space-y-2 border-b pb-4">
          {companyName ? (
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {companyName} · Policy
            </p>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {policy.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {policy.category ? (
              <CategoryChip
                name={policy.category.name}
                color={policy.category.color}
              />
            ) : null}
            <RevisionBadge revision={policy.revision} />
            {policy.publishedAt ? (
              <span>Published {fmtCalendarDate(policy.publishedAt)}</span>
            ) : (
              <span>Draft — not yet published</span>
            )}
          </div>
        </header>

        <PolicyBodyHtml html={policy.body} />

        <footer className="mt-8 border-t pt-4 text-[10px] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {policy.revision > 0
                ? `Revision ${policy.revision}`
                : 'Working draft'}
            </span>
            <span>Printed {fmtCalendarDate(new Date())}</span>
          </div>
        </footer>
      </article>
    </>
  )
}
