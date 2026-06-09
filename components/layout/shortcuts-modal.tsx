'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Shortcut {
  keys: string[]
  label: string
}

interface ShortcutGroup {
  label: string
  shortcuts: Shortcut[]
}

const GROUPS: ShortcutGroup[] = [
  {
    label: 'General',
    shortcuts: [
      { keys: ['⌘', 'K'], label: 'Open command palette' },
      { keys: ['⌘', 'B'], label: 'Toggle sidebar' },
      { keys: ['?'], label: 'Show keyboard shortcuts' },
      { keys: ['Esc'], label: 'Close dialogs / clear selection' },
    ],
  },
  {
    label: 'Tables',
    shortcuts: [
      { keys: ['Space'], label: 'Select / deselect row' },
      { keys: ['Shift', 'Click'], label: 'Select a range' },
    ],
  },
]

interface ShortcutsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Fly around faster with these shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <section key={group.label} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h3>
              <ul className="space-y-1">
                {group.shortcuts.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <span className="text-foreground/90">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={`${k}-${i}`}
                          className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border bg-card px-1.5 text-[11px] font-medium text-foreground/80 shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
