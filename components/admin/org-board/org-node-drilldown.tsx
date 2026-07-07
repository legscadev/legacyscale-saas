import Link from 'next/link'

import { PageHeader } from '@/components/shared'
import { cn } from '@/lib/utils'
import type {
  OrgBoardRevisionSummary,
  OrgNodeRow,
} from '@/lib/services/org-board-service'

import { OrgNodeMenu } from './org-node-menu'

function buildChildrenIndex(subtree: OrgNodeRow[]): Map<string, OrgNodeRow[]> {
  const map = new Map<string, OrgNodeRow[]>()
  for (const n of subtree) {
    if (!n.parentId) continue
    const list = map.get(n.parentId) ?? []
    list.push(n)
    map.set(n.parentId, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.orderIndex - b.orderIndex)
  }
  return map
}

interface OrgNodeDrilldownProps {
  revision: OrgBoardRevisionSummary
  node: OrgNodeRow
  ancestors: OrgNodeRow[]
  subtree: OrgNodeRow[]
}

// Shared with the top-level view — kept in sync with seed palette.
const DIVISION_COLORS: Record<
  string,
  { bg: string; text: string; vfp: string; sub: string }
> = {
  blue: {
    bg: 'bg-blue-600',
    text: 'text-white',
    vfp: 'bg-blue-700',
    sub: 'bg-blue-700/70',
  },
  amber: {
    bg: 'bg-amber-500',
    text: 'text-white',
    vfp: 'bg-amber-600',
    sub: 'bg-amber-600/70',
  },
  indigo: {
    bg: 'bg-indigo-700',
    text: 'text-white',
    vfp: 'bg-indigo-800',
    sub: 'bg-indigo-800/70',
  },
  pink: {
    bg: 'bg-pink-400',
    text: 'text-white',
    vfp: 'bg-pink-500',
    sub: 'bg-pink-500/70',
  },
  emerald: {
    bg: 'bg-emerald-700',
    text: 'text-white',
    vfp: 'bg-emerald-800',
    sub: 'bg-emerald-800/70',
  },
  slate: {
    bg: 'bg-slate-500',
    text: 'text-white',
    vfp: 'bg-slate-600',
    sub: 'bg-slate-600/70',
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-white',
    vfp: 'bg-yellow-600',
    sub: 'bg-yellow-600/70',
  },
}

const FALLBACK_STYLE = DIVISION_COLORS.slate!

/**
 * Walks up the ancestor chain looking for the nearest DIVISION so
 * a drilled-into DEPARTMENT/SECTION inherits its parent division's
 * colour palette.
 */
function findDivisionColor(
  node: OrgNodeRow,
  ancestors: OrgNodeRow[],
): (typeof DIVISION_COLORS)[string] {
  if (node.kind === 'DIVISION') {
    return DIVISION_COLORS[node.color ?? 'blue'] ?? FALLBACK_STYLE
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i]!
    if (a.kind === 'DIVISION') {
      return DIVISION_COLORS[a.color ?? 'blue'] ?? FALLBACK_STYLE
    }
  }
  return FALLBACK_STYLE
}

export function OrgNodeDrilldown({
  revision,
  node,
  ancestors,
  subtree,
}: OrgNodeDrilldownProps) {
  const color = findDivisionColor(node, ancestors)
  // Server component — computed once per request. `useMemo` was
  // pointless here (each render is a fresh server pass) and it
  // forced the file into client-component territory unnecessarily.
  const childrenOf = buildChildrenIndex(subtree)

  const directChildren = childrenOf.get(node.id) ?? []

  // Crown / VP context — walk ancestors for a CROWN entry so we
  // can render "Vice President" above the division header, matching
  // Makh's drill-down.
  const nearestCrown = [...ancestors]
    .reverse()
    .find((a) => a.kind === 'CROWN')

  const breadcrumbs = [
    { label: 'Org Board', href: '/admin/org-board' },
    ...ancestors
      .filter((a) => a.kind === 'DIVISION' || a.kind === 'DEPARTMENT')
      .map((a) => ({ label: a.label, href: `/admin/org-board/nodes/${a.id}` })),
    { label: node.label },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={node.label}
        description={`${revision.name}${node.positionTitle ? ` · ${node.positionTitle}` : ''}`}
      />

      {/* Vice President / crown context */}
      {nearestCrown ? (
        <div className="flex justify-center">
          <div
            className={cn(
              'rounded-md border-2 px-4 py-2 text-center text-sm font-semibold',
              color.bg,
              color.text,
              'border-white/20',
            )}
          >
            {nearestCrown.label}
          </div>
        </div>
      ) : null}

      {/* Division / department header */}
      <div className="rounded-md">
        <div
          className={cn(
            'relative rounded-t-md px-4 py-2 text-center text-sm font-semibold',
            color.bg,
            color.text,
          )}
        >
          <div className="absolute right-2 top-2">
            <OrgNodeMenu
              node={node}
              layout={node.kind === 'DIVISION' ? 'column' : 'row'}
              triggerClassName="text-white"
            />
          </div>
          {node.label}
        </div>
        {node.positionTitle ? (
          <div className={cn('rounded-b-md px-4 py-2 text-center text-sm', color.sub, color.text)}>
            <p className="font-medium">{node.positionTitle}</p>
            <p className="text-xs opacity-80">
              {node.employee?.name ||
                node.freeTextHolder ||
                (
                  <span className="italic opacity-70">
                    Unassigned
                  </span>
                )}
            </p>
          </div>
        ) : null}
      </div>

      {directChildren.length > 0 ? (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${directChildren.length}, minmax(220px, 1fr))`,
          }}
        >
          {directChildren.map((child) => (
            <ColumnNode
              key={child.id}
              node={child}
              childrenOf={childrenOf}
              color={color}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing under this node yet.
        </p>
      )}

      {/* Division-level VFP banner at bottom */}
      {node.vfp ? (
        <div
          className={cn(
            'rounded-md px-4 py-3 text-center text-sm font-medium text-white',
            color.vfp,
          )}
        >
          {node.vfp}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------
// Column renderer — a single sub-node (usually a DEPARTMENT) with its
// entire subtree of SECTION / UNIT / POSITION descendants.
// ---------------------------------------------------------------------

function ColumnNode({
  node,
  childrenOf,
  color,
}: {
  node: OrgNodeRow
  childrenOf: Map<string, OrgNodeRow[]>
  color: (typeof DIVISION_COLORS)[string]
}) {
  const children = childrenOf.get(node.id) ?? []

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-md text-white shadow-sm',
        color.bg,
      )}
    >
      {/* Column header */}
      <div className="relative border-b border-white/20 px-3 py-2 text-center">
        <div className="absolute right-1 top-1">
          <OrgNodeMenu node={node} layout="column" triggerClassName="text-white" />
        </div>
        <Link
          href={`/admin/org-board/nodes/${node.id}`}
          className="block text-[11px] font-semibold uppercase leading-tight tracking-wide hover:underline"
        >
          {node.label}
        </Link>
      </div>

      {/* Director / manager row */}
      {node.positionTitle ? (
        <div className={cn('px-3 py-2 text-center text-[11px]', color.sub)}>
          <p className="font-medium">{node.positionTitle}</p>
          <p className="opacity-80">
            {node.employee?.name ||
              node.freeTextHolder ||
              <span className="italic opacity-70">Unassigned</span>}
          </p>
        </div>
      ) : null}

      {/* Nested body */}
      <div className="flex-1 space-y-3 px-3 py-3 text-[12px] leading-snug">
        {children.length === 0 ? (
          <p className="text-center text-[11px] italic opacity-70">
            (empty)
          </p>
        ) : (
          children.map((child) => (
            <NestedNode
              key={child.id}
              node={child}
              depth={0}
              childrenOf={childrenOf}
            />
          ))
        )}
      </div>

      {/* Per-column VFP */}
      {node.vfp ? (
        <div className={cn('mt-auto px-3 py-2 text-[11px] font-medium', color.vfp)}>
          VFP:
          <p className="mt-1 whitespace-pre-line opacity-95">{node.vfp}</p>
        </div>
      ) : null}
    </div>
  )
}

function NestedNode({
  node,
  depth,
  childrenOf,
}: {
  node: OrgNodeRow
  depth: number
  childrenOf: Map<string, OrgNodeRow[]>
}) {
  const children = childrenOf.get(node.id) ?? []
  const isHeader = node.kind === 'SECTION' || node.kind === 'UNIT'

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : depth * 8 }} className="group space-y-0.5">
      {/* SECTION/UNIT bolded; POSITION plain */}
      <div className="flex items-start justify-between gap-1">
        <p className={cn('flex-1', isHeader ? 'text-[12px] font-semibold' : 'text-[12px]')}>
          {node.label}
        </p>
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <OrgNodeMenu node={node} layout="row" triggerClassName="text-white" />
        </div>
      </div>
      {node.positionTitle ? (
        <p className="text-[11px] opacity-80">{node.positionTitle}</p>
      ) : null}
      {node.employee?.name || node.freeTextHolder ? (
        <p className="text-[11px] opacity-70">
          {node.employee?.name || node.freeTextHolder}
        </p>
      ) : null}

      {children.length > 0 ? (
        <div className="mt-1 space-y-2 border-l border-white/20 pl-2">
          {children.map((child) => (
            <NestedNode
              key={child.id}
              node={child}
              depth={depth + 1}
              childrenOf={childrenOf}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
