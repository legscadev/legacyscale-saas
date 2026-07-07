'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Network } from 'lucide-react'

import { PageHeader, EmptyState } from '@/components/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
  OrgBoardRevisionSummary,
  OrgBoardTree,
  OrgNodeRow,
} from '@/lib/services/org-board-service'

import { OrgNodeMenu } from './org-node-menu'

interface OrgBoardShellProps {
  tree: OrgBoardTree | null
  revisions: OrgBoardRevisionSummary[]
}

// Named palette shared with the seed script. Divisions carry a
// colour token; we translate to Tailwind classes here so tree data
// stays UI-agnostic.
const DIVISION_COLORS: Record<
  string,
  { bg: string; ring: string; text: string; vfp: string }
> = {
  blue: {
    bg: 'bg-blue-600',
    ring: 'ring-blue-700/50',
    text: 'text-white',
    vfp: 'bg-blue-700',
  },
  amber: {
    bg: 'bg-amber-500',
    ring: 'ring-amber-600/50',
    text: 'text-white',
    vfp: 'bg-amber-600',
  },
  indigo: {
    bg: 'bg-indigo-700',
    ring: 'ring-indigo-800/50',
    text: 'text-white',
    vfp: 'bg-indigo-800',
  },
  pink: {
    bg: 'bg-pink-400',
    ring: 'ring-pink-500/50',
    text: 'text-white',
    vfp: 'bg-pink-500',
  },
  emerald: {
    bg: 'bg-emerald-700',
    ring: 'ring-emerald-800/50',
    text: 'text-white',
    vfp: 'bg-emerald-800',
  },
  slate: {
    bg: 'bg-slate-500',
    ring: 'ring-slate-600/50',
    text: 'text-white',
    vfp: 'bg-slate-600',
  },
  yellow: {
    bg: 'bg-yellow-500',
    ring: 'ring-yellow-600/50',
    text: 'text-white',
    vfp: 'bg-yellow-600',
  },
}

const CROWN_STYLE = {
  bg: 'bg-sky-600',
  text: 'text-white',
  ring: 'ring-sky-700/40',
}

export function OrgBoardShell({ tree, revisions }: OrgBoardShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentRevisionId =
    searchParams.get('revision') ??
    revisions.find((r) => r.isCurrent)?.id ??
    revisions[0]?.id ??
    ''

  function pickRevision(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('revision', id)
    router.push(`/admin/org-board?${params.toString()}`)
  }

  if (!tree) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Org Board"
          description="Hubbard-style organizing chart for the internal team."
        />
        <EmptyState
          icon={Network}
          tone="brand"
          title="No org board yet"
          description="Seed the default revision or create one via the API."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Org Board"
        description={`${tree.revision.name}${
          tree.revision.description ? ` · ${tree.revision.description}` : ''
        }`}
        actions={
          revisions.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Revision
              </span>
              <Select
                value={currentRevisionId}
                onValueChange={(v) => pickRevision(v ?? '')}
              >
                <SelectTrigger className="h-9 min-w-[180px]">
                  <SelectValue>
                    {(v: string) => {
                      const r = revisions.find((rev) => rev.id === v)
                      if (!r) return 'Select revision'
                      return `${r.name}${r.isCurrent ? ' · current' : ''}`
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {revisions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.isCurrent ? ' · current' : ''}
                      {r.publishedAt
                        ? ` (${format(r.publishedAt, 'MMM d, yyyy')})`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null
        }
      />

      <TopLevelChart nodes={tree.nodes} />
    </div>
  )
}

// ---------------------------------------------------------------------
// Top-level view — crown chain + 7 divisions
// ---------------------------------------------------------------------

function TopLevelChart({ nodes }: { nodes: OrgNodeRow[] }) {
  const { crown, divisions, boardVfp, byParent } = useMemo(() => {
    const crown = nodes
      .filter((n) => n.kind === 'CROWN')
      .sort((a, b) => a.orderIndex - b.orderIndex)
    const divisions = nodes
      .filter((n) => n.kind === 'DIVISION')
      .sort((a, b) => a.orderIndex - b.orderIndex)
    // The overall VFP banner is stored as a root-level POSITION with
    // a VFP string; anything else at that level with kind POSITION
    // would count as a stray and we ignore it.
    const boardVfp = nodes.find(
      (n) => n.kind === 'POSITION' && n.parentId === null && n.vfp,
    )

    // Index children by parentId for O(1) lookup while rendering.
    const byParent = new Map<string, OrgNodeRow[]>()
    for (const n of nodes) {
      if (!n.parentId) continue
      const list = byParent.get(n.parentId) ?? []
      list.push(n)
      byParent.set(n.parentId, list)
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.orderIndex - b.orderIndex)
    }

    return { crown, divisions, boardVfp, byParent }
  }, [nodes])

  return (
    <div className="space-y-6 overflow-x-auto">
      {/* Crown chain */}
      <div className="flex justify-center">
        <div className="flex flex-col items-center gap-4">
          {crown.map((c) => (
            <CrownCard key={c.id} node={c} />
          ))}
        </div>
      </div>

      {/* Divisions row */}
      {divisions.length > 0 ? (
        <div className="relative">
          {/* Connector line above divisions */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
            <div className="h-4 w-px bg-border" />
          </div>
          <div
            className="grid gap-3 pt-4"
            style={{
              gridTemplateColumns: `repeat(${divisions.length}, minmax(180px, 1fr))`,
            }}
          >
            {divisions.map((div) => (
              <DivisionColumn
                key={div.id}
                node={div}
                depts={byParent.get(div.id) ?? []}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Board VFP banner */}
      {boardVfp?.vfp ? (
        <div className="mt-6 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm">
          {boardVfp.vfp}
        </div>
      ) : null}
    </div>
  )
}

function CrownCard({ node }: { node: OrgNodeRow }) {
  return (
    <div
      className={cn(
        'w-[220px] overflow-hidden rounded-md shadow-sm ring-1',
        CROWN_STYLE.bg,
        CROWN_STYLE.text,
        CROWN_STYLE.ring,
      )}
    >
      <div className="border-b border-white/20 px-3 py-2 text-center text-sm font-semibold">
        {node.label}
      </div>
      <div className="flex items-center justify-between gap-2 bg-white/10 px-3 py-2 text-sm">
        <span className="truncate">
          {node.employee?.name || node.freeTextHolder || (
            <span className="italic opacity-70">Unassigned</span>
          )}
        </span>
        <OrgNodeMenu node={node} layout="row" triggerClassName="text-white" />
      </div>
    </div>
  )
}

function DivisionColumn({
  node,
  depts,
}: {
  node: OrgNodeRow
  depts: OrgNodeRow[]
}) {
  const style =
    DIVISION_COLORS[node.color ?? 'blue'] ?? DIVISION_COLORS.blue!

  return (
    <div className="flex flex-col overflow-hidden rounded-md shadow-sm">
      {/* Division header + director */}
      <div className={cn('relative px-3 py-2 text-center', style.bg, style.text)}>
        <div className="absolute right-1 top-1">
          <OrgNodeMenu node={node} layout="column" triggerClassName="text-white" />
        </div>
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide">
          {node.label}
        </p>
        {node.positionTitle ? (
          <div className="mt-2 rounded bg-black/20 px-2 py-1 text-xs font-medium">
            <p className="truncate">{node.positionTitle}</p>
            {node.employee?.name || node.freeTextHolder ? (
              <p className="truncate text-[11px] opacity-80">
                {node.employee?.name || node.freeTextHolder}
              </p>
            ) : (
              <p className="truncate text-[11px] italic opacity-70">
                Unassigned
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Departments stacked in the column body */}
      <div
        className={cn('flex-1 space-y-3 px-3 py-3 text-white', style.bg)}
      >
        {depts.length === 0 ? (
          <p className="text-center text-xs italic opacity-70">
            No departments yet
          </p>
        ) : (
          depts.map((dept) => (
            <DepartmentBlock key={dept.id} node={dept} />
          ))
        )}
      </div>

      {/* Optional per-division VFP footer */}
      {node.vfp ? (
        <div className={cn('px-3 py-2 text-[11px] font-medium text-white', style.vfp)}>
          {node.vfp}
        </div>
      ) : null}
    </div>
  )
}

function DepartmentBlock({ node }: { node: OrgNodeRow }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/admin/org-board/nodes/${node.id}`}
          className="block flex-1 text-[11px] font-semibold leading-snug hover:underline"
        >
          {node.label}
        </Link>
        <OrgNodeMenu node={node} layout="row" triggerClassName="text-white" />
      </div>
      {node.positionTitle ? (
        <p className="text-[11px] opacity-90">{node.positionTitle}</p>
      ) : null}
      {node.employee?.name || node.freeTextHolder ? (
        <p className="text-[11px] opacity-70">
          {node.employee?.name || node.freeTextHolder}
        </p>
      ) : null}
    </div>
  )
}

