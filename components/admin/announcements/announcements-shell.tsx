'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Edit3,
  Megaphone,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import type { AnnouncementStatus } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared'
import { htmlToPlainText } from '@/lib/utils'
import {
  fetchAnnouncements,
  softDeleteAnnouncementAction,
  type AnnouncementsData,
  type AnnouncementsQueryState,
} from '@/app/(admin)/admin/announcements/actions'
import type {
  AnnouncementListItem,
  AnnouncementView,
} from '@/lib/services/announcement-service'

export const DEFAULT_QUERY_STATE: AnnouncementsQueryState = {
  search: '',
  status: null,
  view: 'active',
  page: 1,
}

const PAGE_SIZE = 20

interface AnnouncementsShellProps {
  initialData: AnnouncementsData
}

export function AnnouncementsShell({ initialData }: AnnouncementsShellProps) {
  const [query, setQuery] = useState<AnnouncementsQueryState>(DEFAULT_QUERY_STATE)
  const [data, setData] = useState<AnnouncementsData>(initialData)
  const [isPending, startTransition] = useTransition()
  const [refetchKey, setRefetchKey] = useState(0)

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    let cancelled = false
    startTransition(() => {
      fetchAnnouncements(query).then((next) => {
        if (!cancelled) setData(next)
      })
    })
    return () => {
      cancelled = true
    }
  }, [query, refetchKey])

  const patch = useCallback((updates: Partial<AnnouncementsQueryState>) => {
    setQuery((prev) => {
      const resetsPage = !('page' in updates)
      return {
        ...prev,
        ...updates,
        ...(resetsPage ? { page: 1 } : {}),
      }
    })
  }, [])

  const clearFilters = useCallback(() => setQuery(DEFAULT_QUERY_STATE), [])
  const refetch = useCallback(() => setRefetchKey((k) => k + 1), [])
  const columns = useMemo(() => getColumns(refetch), [refetch])

  const hasActiveFilters =
    query.search.length > 0 ||
    query.status !== null ||
    query.view !== 'active'
  const showEmpty = data.items.length === 0
  const noAnnouncementsAtAll =
    data.counts.all === 0 && data.counts.deleted === 0

  return (
    <div className="space-y-6" data-pending={isPending}>
      <PageHeader
        title="Announcements"
        description={`Manage ${data.counts.all.toLocaleString()} ${
          data.counts.all === 1 ? 'announcement' : 'announcements'
        } across your platform.`}
        actions={
          <Button render={<Link href="/admin/announcements/new" />}>
            <Plus className="size-4" />
            New announcement
          </Button>
        }
      />

      <Toolbar
        search={query.search}
        status={query.status}
        view={query.view}
        onSearchChange={(search) => patch({ search })}
        onStatusChange={(status) => patch({ status })}
        onViewChange={(view) => patch({ view })}
        onClearAll={clearFilters}
        isPending={isPending}
      />

      {showEmpty ? (
        <EmptyState
          icon={Megaphone}
          title={
            hasActiveFilters
              ? 'No announcements match these filters'
              : noAnnouncementsAtAll
                ? 'No announcements yet'
                : 'No results'
          }
          description={
            hasActiveFilters
              ? 'Try widening your search or clearing filters.'
              : noAnnouncementsAtAll
                ? 'Create your first announcement to communicate with members.'
                : 'Announcements will appear here when they match these filters.'
          }
        >
          {noAnnouncementsAtAll && !hasActiveFilters ? (
            <Button render={<Link href="/admin/announcements/new" />}>
              <Plus className="size-4" />
              New announcement
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <DataTable
          key={refetchKey}
          columns={columns}
          data={data.items}
          page={data.page}
          pageCount={data.totalPages}
          total={data.total}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => patch({ page })}
          sorting={[]}
          onSortingChange={() => {}}
          getRowId={(row) => row.id}
        />
      )}
    </div>
  )
}

// ===========================================================
// Toolbar
// ===========================================================

const STATUSES = [
  { value: 'all', label: 'Any status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
]
const VIEWS = [
  { value: 'active', label: 'Active' },
  { value: 'deleted', label: 'Deleted' },
]

interface ToolbarProps {
  search: string
  status: AnnouncementStatus | null
  view: AnnouncementView
  onSearchChange: (value: string) => void
  onStatusChange: (status: AnnouncementStatus | null) => void
  onViewChange: (view: AnnouncementView) => void
  onClearAll: () => void
  isPending: boolean
}

function Toolbar({
  search,
  status,
  view,
  onSearchChange,
  onStatusChange,
  onViewChange,
  onClearAll,
  isPending,
}: ToolbarProps) {
  const [draft, setDraft] = useState(search)
  useEffect(() => setDraft(search), [search])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (draft === search) return
    debounceRef.current = setTimeout(() => onSearchChange(draft.trim()), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const statusValue = status ?? 'all'
  const hasActiveFilters =
    search.length > 0 || status !== null || view !== 'active'

  return (
    <div className="sticky top-0 z-10 -mx-px flex flex-col gap-3 bg-background/95 px-px py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search title or body…"
          className="pl-8"
          data-pending={isPending}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusValue}
          onValueChange={(v) =>
            onStatusChange(!v || v === 'all' ? null : (v as AnnouncementStatus))
          }
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue>
              {(v: string) =>
                STATUSES.find((s) => s.value === v)?.label ?? 'Any status'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={view}
          onValueChange={(v) =>
            onViewChange((v as AnnouncementView) ?? 'active')
          }
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue>
              {(v: string) =>
                VIEWS.find((x) => x.value === v)?.label ?? 'Active'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {VIEWS.map((x) => (
              <SelectItem key={x.value} value={x.value}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

// ===========================================================
// Columns
// ===========================================================

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getColumns(
  onRefetch: () => void,
): ColumnDef<AnnouncementListItem>[] {
  return [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const a = row.original
        const preview = htmlToPlainText(a.body)
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Megaphone className="size-4 text-primary" />
            </div>
            {/* Hard max-width here is load-bearing: the DataTable uses
                table-layout: auto, so without an inner cap the <td>
                grows to fit a long body preview and pushes the
                right-side columns off-screen on smaller viewports. */}
            <div className="min-w-0 max-w-[28rem] flex-1">
              <Link
                href={`/admin/announcements/${a.id}/edit`}
                className="block truncate text-sm font-semibold transition-colors hover:text-primary hover:underline underline-offset-2"
              >
                {a.title}
              </Link>
              <p className="truncate text-xs text-muted-foreground/80">
                {preview || 'No body yet.'}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      enableSorting: false,
      size: 110,
    },
    {
      accessorKey: 'publishedAt',
      header: 'Published',
      cell: ({ row }) => (
        <span
          className="text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          {formatDate(row.original.publishedAt)}
        </span>
      ),
      enableSorting: false,
      size: 130,
    },
    {
      id: 'reads',
      header: 'Reads',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original._count.reads.toLocaleString()}
        </span>
      ),
      enableSorting: false,
      size: 80,
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ActionsMenu
            announcementId={row.original.id}
            title={row.original.title}
            isDeleted={!!row.original.deletedAt}
            onRefetch={onRefetch}
          />
        </div>
      ),
      enableSorting: false,
      size: 56,
      meta: { className: 'pr-4 w-14', stopRowClick: true },
    },
  ]
}

// ===========================================================
// Actions Menu
// ===========================================================

interface ActionsMenuProps {
  announcementId: string
  title: string
  isDeleted: boolean
  onRefetch: () => void
}

function ActionsMenu({
  announcementId,
  title,
  isDeleted,
  onRefetch,
}: ActionsMenuProps) {
  const router = useRouter()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, setPending] = useState(false)

  async function softDelete() {
    setPending(true)
    try {
      const result = await softDeleteAnnouncementAction(announcementId)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete announcement')
        return
      }
      toast.success(`${title} deleted`, {
        description: 'You can restore it from the Deleted view.',
      })
      onRefetch()
    } finally {
      setPending(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Open actions"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isDeleted ? (
            <DropdownMenuItem disabled>
              Deleted announcements can be restored from the DB for now.
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/admin/announcements/${announcementId}/edit`)
                }
              >
                <Edit3 />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmingDelete(true)}
                className="text-destructive"
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The announcement will be hidden everywhere. You can restore it
              later from the Deleted view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                softDelete()
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Deleting…' : 'Delete announcement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
