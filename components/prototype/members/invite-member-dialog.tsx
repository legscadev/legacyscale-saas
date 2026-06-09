"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

interface InviteMemberDialogProps {
  triggerLabel?: string
  defaultRole?: "MEMBER" | "ADMIN"
  triggerSize?: "default" | "sm"
}

export function InviteMemberDialog({
  triggerLabel = "Invite member",
  defaultRole = "MEMBER",
  triggerSize = "default",
}: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<string>(defaultRole)

  const submit = () => {
    if (!email.trim()) {
      toast.error("Enter an email address.")
      return
    }
    toast.success(`Invitation sent to ${email.trim()}`)
    setOpen(false)
    setEmail("")
    setName("")
    setRole(defaultRole)
  }

  return (
    <>
      <Button size={triggerSize} onClick={() => setOpen(true)}>
        <UserPlus />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>
              They&apos;ll receive an email invite to set up their account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">
                Name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="invite-name"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                className={SELECT_CLASS}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
