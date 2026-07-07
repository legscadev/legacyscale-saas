'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useTheme } from 'next-themes'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type ColorMode,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { Camera, FileDown } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OrgNodeRow } from '@/lib/services/org-board-service'

import { AssignmentBadge, HolderText } from './holder-text'

interface OrgFlowChartProps {
  nodes: OrgNodeRow[]
  onNodeClick?: (nodeId: string) => void
}

// ---------------------------------------------------------------------
// Palette (kept in sync with seed + shell classic view).
// ---------------------------------------------------------------------
const COLOR_BG: Record<string, string> = {
  blue: 'bg-blue-600',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-700',
  pink: 'bg-pink-400',
  emerald: 'bg-emerald-700',
  slate: 'bg-slate-500',
  yellow: 'bg-yellow-500',
}

const CROWN_BG = 'bg-sky-600'
const NODE_WIDTH = 220
const CROWN_GAP_Y = 90
const DIV_GAP_X = 240
const DIV_GAP_Y = 40
const DEPT_GAP_Y = 80

/**
 * Coarse layout for the org tree — enough for a first-pass chart.
 * Later we can swap this out for a proper hierarchical layout lib
 * (dagre / elkjs), but for the Hubbard 7-division shape the manual
 * placement gives a predictable result.
 */
function layoutNodes(rows: OrgNodeRow[]): {
  flowNodes: Node[]
  flowEdges: Edge[]
} {
  const crown = rows
    .filter((n) => n.kind === 'CROWN')
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const divisions = rows
    .filter((n) => n.kind === 'DIVISION')
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const byParent = new Map<string, OrgNodeRow[]>()
  for (const n of rows) {
    if (!n.parentId) continue
    const list = byParent.get(n.parentId) ?? []
    list.push(n)
    byParent.set(n.parentId, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.orderIndex - b.orderIndex)
  }

  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []

  // Crown chain — centred column
  const crownX = ((divisions.length - 1) * DIV_GAP_X) / 2
  crown.forEach((c, i) => {
    flowNodes.push({
      id: c.id,
      position: { x: crownX, y: i * CROWN_GAP_Y },
      data: { row: c },
      type: 'orgNode',
    })
    if (i > 0) {
      flowEdges.push({
        id: `${crown[i - 1]!.id}-${c.id}`,
        source: crown[i - 1]!.id,
        target: c.id,
        type: 'smoothstep',
      })
    }
  })
  const crownBottomY = Math.max(crown.length - 1, 0) * CROWN_GAP_Y

  // Divisions spread horizontally beneath the crown
  const divStartY = crownBottomY + DIV_GAP_Y * 2
  divisions.forEach((d, i) => {
    flowNodes.push({
      id: d.id,
      position: { x: i * DIV_GAP_X, y: divStartY },
      data: { row: d },
      type: 'orgNode',
    })
    if (crown.length > 0) {
      flowEdges.push({
        id: `${crown[crown.length - 1]!.id}-${d.id}`,
        source: crown[crown.length - 1]!.id,
        target: d.id,
        type: 'smoothstep',
      })
    }
    // Departments stacked below their division
    const depts = byParent.get(d.id) ?? []
    depts.forEach((dep, j) => {
      flowNodes.push({
        id: dep.id,
        position: {
          x: i * DIV_GAP_X,
          y: divStartY + (j + 1) * DEPT_GAP_Y + 30,
        },
        data: { row: dep },
        type: 'orgNode',
      })
      flowEdges.push({
        id: `${d.id}-${dep.id}`,
        source: d.id,
        target: dep.id,
        type: 'smoothstep',
      })
    })
  })

  return { flowNodes, flowEdges }
}

function OrgNodeCard({ data }: NodeProps) {
  const row = (data as { row: OrgNodeRow }).row
  const bg =
    row.kind === 'CROWN'
      ? CROWN_BG
      : row.kind === 'DIVISION'
        ? (COLOR_BG[row.color ?? 'blue'] ?? COLOR_BG.blue!)
        : row.kind === 'DEPARTMENT'
          ? // Departments inherit the division colour visually via the
            // shared column tint. For the chart we render them slightly
            // darker so they read as children.
            (COLOR_BG[row.color ?? 'slate'] ?? 'bg-slate-600')
          : 'bg-slate-500'
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={cn(
        'overflow-hidden rounded-md text-white shadow-md ring-1 ring-black/10',
        bg,
      )}
    >
      <Handle type="target" position={Position.Top} />
      <div className="border-b border-white/20 px-3 py-2 text-center text-[11px] font-semibold uppercase leading-tight tracking-wide">
        {row.label}
      </div>
      {row.positionTitle || row.holder.kind !== 'unassigned' ? (
        <div className="px-3 py-2 text-center text-[11px]">
          {row.positionTitle ? (
            <p className="font-medium">{row.positionTitle}</p>
          ) : null}
          <p className="flex items-center justify-center gap-1.5 opacity-80">
            <HolderText holder={row.holder} />
            <AssignmentBadge count={row.activeAssignmentsCount} />
          </p>
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const NODE_TYPES = { orgNode: OrgNodeCard }

/**
 * Wrapper that adds the export buttons + provider. Export uses
 * html-to-image against the chart container ref; the PNG is either
 * downloaded directly or wrapped into a landscape A4 PDF.
 */
export function OrgFlowChart({ nodes, onNodeClick }: OrgFlowChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { flowNodes, flowEdges } = useMemo(() => layoutNodes(nodes), [nodes])
  // Feed the resolved theme to ReactFlow so the built-in Controls
  // switch to their dark palette. Without this the +/- buttons stay
  // white-on-white when the app is in dark mode.
  const { resolvedTheme } = useTheme()
  const colorMode: ColorMode =
    resolvedTheme === 'dark' ? 'dark' : 'light'

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      onNodeClick?.(node.id)
    },
    [onNodeClick],
  )

  async function exportPng() {
    if (!containerRef.current) return
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.download = `org-board-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
      toast.success('PNG downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export')
    }
  }

  async function exportPdf() {
    if (!containerRef.current) return
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
      })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const w = pdf.internal.pageSize.getWidth()
      const h = pdf.internal.pageSize.getHeight()
      pdf.addImage(dataUrl, 'PNG', 20, 20, w - 40, h - 40)
      pdf.save(`org-board-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={exportPng}
        >
          <Camera className="mr-1.5 size-4" />
          PNG
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={exportPdf}
        >
          <FileDown className="mr-1.5 size-4" />
          PDF
        </Button>
      </div>
      <div
        ref={containerRef}
        className="h-[720px] w-full overflow-hidden rounded-xl border bg-muted/10"
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={NODE_TYPES}
            onNodeClick={handleNodeClick}
            colorMode={colorMode}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesConnectable={false}
            nodesDraggable
            elementsSelectable
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  )
}
