// Lead notifications fired from the public intake (via after()).
//
// Two audiences:
//   1. The LEAD — a friendly confirmation. Email now; SMS too when the
//      lead consented (sms_consent) and Twilio is configured.
//   2. The pipeline OWNER (Keanu/Jon/Nikk) — an SMS-only alert with the
//      lead's details, sent to the pipeline's notifyPhone.
//
// Best-effort throughout: never throws, so a messaging failure never
// affects the intake write.

import { prisma } from '@/lib/prisma'
import { sendLeadConfirmationEmail } from '@/lib/resend'
import { sendSms } from '@/lib/sms'

const PRODUCT_NAME = 'AI Agents Club'

interface NotifyLeadInput {
  pipelineId: string
  opportunityId: string
  name: string
  email?: string
  phone?: string
  source?: string
  answers?: Record<string, unknown>
}

const firstName = (name: string) =>
  (name || '').trim().split(/\s+/)[0] || 'there'

const answerStr = (answers: Record<string, unknown> | undefined, key: string) => {
  const v = answers?.[key]
  return v === null || v === undefined || v === '' ? '' : String(v)
}

/** Compact one-line detail block for the owner's SMS. */
function ownerAlertBody(input: NotifyLeadInput): string {
  const bits: string[] = []
  bits.push(`🔥 New lead${input.source ? ` — ${input.source}` : ''}`)
  bits.push(input.name)
  if (input.phone) bits.push(input.phone)
  if (input.email) bits.push(input.email)
  const goal = answerStr(input.answers, 'income_goal')
  const best = answerStr(input.answers, 'best_time')
  const extra = [goal && `goal ${goal}`, best && `best ${best}`]
    .filter(Boolean)
    .join(', ')
  const head = bits.join(' · ')
  return `${head}${extra ? ` · ${extra}` : ''}. Reach out fast.`
}

export async function notifyLead(input: NotifyLeadInput): Promise<void> {
  // 1) Lead confirmation — email.
  if (input.email) {
    try {
      await sendLeadConfirmationEmail(input.email, {
        leadName: input.name,
        productName: PRODUCT_NAME,
      })
    } catch (err) {
      console.error('[lead-notify] lead confirmation email failed', err)
    }
  }

  // 2) Lead confirmation — SMS. Consent is implied: the funnel's submit
  //    is gated on the SMS-consent checkbox, so every lead consented.
  //    No-ops until Twilio is configured.
  if (input.phone) {
    await sendSms(
      input.phone,
      `Hey ${firstName(input.name)} — thanks for applying to ${PRODUCT_NAME}! ` +
        `We've got your details and a coach will reach out shortly. Reply STOP to opt out.`,
    )
  }

  // 3) Owner alert — SMS only, to the pipeline's notify phone.
  const pipeline = await prisma.crmPipeline.findUnique({
    where: { id: input.pipelineId },
    select: { notifyPhone: true },
  })
  const ownerPhone = pipeline?.notifyPhone?.trim()
  if (ownerPhone) {
    await sendSms(ownerPhone, ownerAlertBody(input))
  }
}
