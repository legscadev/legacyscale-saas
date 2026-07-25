'use client'

import { useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import {
  fetchAppointments,
  fetchEntries,
  fetchMonthlyAggregates,
  fetchTargets,
  type AppointmentRow,
  type DailyEntry,
  type MonthlyAggregateRow,
  type MonthlyTargets,
  type ProductionUserOption,
} from '@/app/(admin)/admin/production-sheets/actions'
import { ALL_USERS } from '@/lib/production/metrics'

import { AppointmentsList } from './appointments-list'
import { DailyEntryGrid } from './daily-entry-grid'
import { MasterDataView } from './master-data-view'

interface ProductionShellProps {
  currentUserId: string
  currentUserIsAdmin: boolean
  users: ProductionUserOption[]
  initialTargetUserId: string
  initialYear: number
  initialMonth: number
  initialEntries: DailyEntry[]
  initialTargets: MonthlyTargets
  initialAppointments: AppointmentRow[]
  initialAggregates: MonthlyAggregateRow[]
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Client shell for the Production module. Renders three tabs — Daily
 * Entry, Appointments, Master Data — with a shared header holding
 * the user picker (admin-only) and month navigator.
 *
 * Initial data is passed in from the server component so the first
 * paint is fully rendered; subsequent user/month switches call the
 * server actions and swap state.
 */
export function ProductionShell(props: ProductionShellProps) {
  const {
    currentUserId,
    currentUserIsAdmin,
    users,
    initialTargetUserId,
    initialYear,
    initialMonth,
    initialEntries,
    initialTargets,
    initialAppointments,
    initialAggregates,
  } = props

  const [targetUserId, setTargetUserId] = useState(initialTargetUserId)
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [entries, setEntries] = useState(initialEntries)
  const [targets, setTargets] = useState(initialTargets)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [aggregates, setAggregates] = useState(initialAggregates)
  const [loading, startLoading] = useTransition()

  // All slice changes (user picker, month step, year change) flow
  // through this loader so we never fire the fetch from useEffect —
  // simpler + no cascading renders. Initial data comes from the
  // server component, so we only enter here on user interaction.
  const loadSlice = (nextUserId: string, nextYear: number, nextMonth: number) => {
    setTargetUserId(nextUserId)
    setYear(nextYear)
    setMonth(nextMonth)
    startLoading(async () => {
      const [e, t, a, agg] = await Promise.all([
        fetchEntries(nextUserId, nextYear, nextMonth),
        fetchTargets(nextUserId, nextYear, nextMonth),
        fetchAppointments({ userId: nextUserId, year: nextYear, month: nextMonth }),
        fetchMonthlyAggregates(nextUserId, 12),
      ])
      setEntries(e)
      setTargets(t)
      setAppointments(a)
      setAggregates(agg)
    })
  }

  const targetUser = useMemo(
    () => users.find((u) => u.id === targetUserId),
    [users, targetUserId],
  )
  const isAllView = targetUserId === ALL_USERS

  const stepMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    loadSlice(targetUserId, y, m)
  }

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear()
    return [now - 2, now - 1, now, now + 1]
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Production</h1>
        <p className="text-muted-foreground">
          Daily production sheet — track calls, DMs, appointments, and revenue.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {currentUserIsAdmin ? (
          <Select
            value={targetUserId}
            onValueChange={(v) => {
              if (v) loadSlice(v, year, month)
            }}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue>
                {(v: string) =>
                  v === ALL_USERS
                    ? 'All users (aggregate)'
                    : users.find((u) => u.id === v)?.name ?? 'Select user'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_USERS}>
                <span className="font-medium">All users</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  Sum across the team
                </span>
              </SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                  {u.roleTitle ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {u.roleTitle}
                    </span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-sm text-muted-foreground">
            Viewing your own production sheet
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => stepMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={String(month)}
            onValueChange={(v) => v && loadSlice(targetUserId, year, Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue>{(v: string) => MONTHS[Number(v) - 1] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((label, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(year)}
            onValueChange={(v) => v && loadSlice(targetUserId, Number(v), month)}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue>{(v: string) => v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => stepMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="daily" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Entry</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="master">Master Data</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-0">
          <DailyEntryGrid
            userId={targetUserId}
            year={year}
            month={month}
            entries={entries}
            targets={targets}
            loading={loading}
            readOnly={isAllView}
            onEntriesChange={setEntries}
            onTargetsChange={setTargets}
          />
        </TabsContent>

        <TabsContent value="appointments" className="mt-0">
          <AppointmentsList
            actorId={currentUserId}
            targetUserId={targetUserId}
            targetUserName={
              isAllView ? 'All users' : targetUser?.name ?? 'This user'
            }
            users={users}
            currentUserIsAdmin={currentUserIsAdmin}
            appointments={appointments}
            loading={loading}
            readOnly={isAllView}
            onChange={setAppointments}
          />
        </TabsContent>

        <TabsContent value="master" className="mt-0">
          <MasterDataView aggregates={aggregates} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
