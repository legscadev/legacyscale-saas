'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { revokeCertificateAction } from '@/app/(admin)/admin/certificates/actions'
import type { AdminCertificateRow } from '@/app/(admin)/admin/certificates/actions'

interface RevokeCertificateDialogProps {
  target: AdminCertificateRow | null
  onOpenChange: (open: boolean) => void
  onRevoked: () => void
}

export function RevokeCertificateDialog({
  target,
  onOpenChange,
  onRevoked,
}: RevokeCertificateDialogProps) {
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    if (!target) return
    startTransition(async () => {
      const result = await revokeCertificateAction(
        target.id,
        reason.trim() || null,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Certificate revoked')
      onRevoked()
      onOpenChange(false)
      setReason('')
    })
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) setReason('')
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke certificate</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                Revoking&nbsp;
                <strong>{target.module.title}</strong> for{' '}
                <strong>{target.member.name?.trim() || target.member.email}</strong>.
                The member will lose access immediately. This can be reversed.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="revoke-reason">Reason (optional)</Label>
          <Textarea
            id="revoke-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Issued to the wrong module by mistake"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? 'Revoking…' : 'Revoke certificate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
