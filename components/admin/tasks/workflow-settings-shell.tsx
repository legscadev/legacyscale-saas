'use client'

// Workflow admin shell at /admin/tasks/settings. Three sections —
// statuses, categories, labels — each with inline add + edit + delete.
// Row-level mutations dispatch the corresponding server action,
// optimistically update the local list on ok, roll back + toast on
// error.

import { useState, useTransition } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import {
  deleteCategoryAction,
  deleteLabelAction,
  deleteStatusAction,
  upsertCategoryAction,
  upsertLabelAction,
  upsertStatusAction,
  type WorkflowSettingsPayload,
} from '@/app/(admin)/admin/tasks/settings/actions'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

import { CategoryLabelRows } from './workflow-settings-taxonomy'
import { StatusRows } from './workflow-settings-statuses'

interface WorkflowSettingsShellProps {
  initialData: WorkflowSettingsPayload
}

export function WorkflowSettingsShell({
  initialData,
}: WorkflowSettingsShellProps) {
  const [statuses, setStatuses] = useState(initialData.statuses)
  const [categories, setCategories] = useState(initialData.categories)
  const [labels, setLabels] = useState(initialData.labels)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tasks', href: '/admin/tasks' },
          { label: 'Workflow settings' },
        ]}
        title="Workflow settings"
        description="Configure the statuses, categories, and labels that drive your team's task tracker."
        actions={
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/admin/tasks" />}
          >
            <ArrowLeft className="size-4" />
            Back to tasks
          </Button>
        }
      />

      <Section
        title="Statuses"
        description="Columns in the Kanban board. New tasks land in the default status; terminal statuses drop out of the Open count."
        onAdd={() => {
          const draft = {
            id: undefined,
            name: 'New status',
            slug: `status-${Date.now().toString(36)}`,
            color: '#94a3b8',
            orderIndex: statuses.length,
            isDefault: false,
            isTerminal: false,
            wipLimit: null,
          }
          upsertStatusAction(draft).then((res) => {
            if (!res.ok) {
              toast.error(res.error ?? 'Could not add status')
              return
            }
            setStatuses((prev) => [...prev, res.data])
            toast.success('Status added')
          })
        }}
        addLabel="Add status"
      >
        <StatusRows
          statuses={statuses}
          onPatched={(next) =>
            setStatuses((prev) =>
              prev.map((s) => (s.id === next.id ? next : s)),
            )
          }
          onDeleted={(id) =>
            setStatuses((prev) => prev.filter((s) => s.id !== id))
          }
        />
      </Section>

      <Section
        title="Categories"
        description="Rough classification for a task (Bug, Feature, Ops, etc.). Optional per task."
        onAdd={() => {
          upsertCategoryAction({ name: 'New category', color: '#94a3b8' }).then(
            (res) => {
              if (!res.ok) {
                toast.error(res.error ?? 'Could not add category')
                return
              }
              setCategories((prev) => [...prev, res.data])
              toast.success('Category added')
            },
          )
        }}
        addLabel="Add category"
      >
        <CategoryLabelRows
          items={categories}
          onSave={(input) => upsertCategoryAction(input)}
          onDelete={(id) => deleteCategoryAction(id)}
          onPatched={(next) =>
            setCategories((prev) =>
              prev.map((c) => (c.id === next.id ? next : c)),
            )
          }
          onDeleted={(id) =>
            setCategories((prev) => prev.filter((c) => c.id !== id))
          }
          emptyLabel="No categories yet."
        />
      </Section>

      <Section
        title="Labels"
        description="Free-form tags a task can carry any number of."
        onAdd={() => {
          upsertLabelAction({ name: 'new-label', color: '#94a3b8' }).then(
            (res) => {
              if (!res.ok) {
                toast.error(res.error ?? 'Could not add label')
                return
              }
              setLabels((prev) => [...prev, res.data])
              toast.success('Label added')
            },
          )
        }}
        addLabel="Add label"
      >
        <CategoryLabelRows
          items={labels}
          onSave={(input) => upsertLabelAction(input)}
          onDelete={(id) => deleteLabelAction(id)}
          onPatched={(next) =>
            setLabels((prev) =>
              prev.map((l) => (l.id === next.id ? next : l)),
            )
          }
          onDeleted={(id) =>
            setLabels((prev) => prev.filter((l) => l.id !== id))
          }
          emptyLabel="No labels yet."
        />
      </Section>
    </div>
  )
}

// =========================================================
// Section shell (title + add button + child rows)
// =========================================================

interface SectionProps {
  title: string
  description: string
  onAdd: () => void
  addLabel: string
  children: React.ReactNode
}

function Section({
  title,
  description,
  onAdd,
  addLabel,
  children,
}: SectionProps) {
  const [isAdding, startAdd] = useTransition()

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => startAdd(onAdd)}
          disabled={isAdding}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </div>
      <div className="rounded-lg border bg-card">{children}</div>
    </section>
  )
}
