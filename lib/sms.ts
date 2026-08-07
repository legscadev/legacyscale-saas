// Thin Twilio SMS sender. No SDK — a single form-encoded POST to the
// Twilio REST API. Safe no-op (logs a warning) when Twilio isn't
// configured, so callers can wire SMS now and it activates the moment
// the TWILIO_* env vars are set.
//
// Env:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER   (E.164, e.g. +15551234567) — or a Messaging
//                        Service SID via TWILIO_MESSAGING_SERVICE_SID

interface SendSmsResult {
  sent: boolean
  error?: string
}

/** Send one SMS. Best-effort: never throws. */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

  const recipient = (to || '').trim()
  if (!recipient) return { sent: false, error: 'no_recipient' }

  if (!sid || !token || (!from && !messagingServiceSid)) {
    console.warn('[sms] Twilio not configured — skipping SMS to', recipient)
    return { sent: false, error: 'not_configured' }
  }

  const params = new URLSearchParams({ To: recipient, Body: body })
  if (messagingServiceSid) params.set('MessagingServiceSid', messagingServiceSid)
  else if (from) params.set('From', from)

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[sms] Twilio error', res.status, text.slice(0, 200))
      return { sent: false, error: `http_${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.error('[sms] send failed', err)
    return { sent: false, error: 'exception' }
  }
}

/** Twilio configured? (for callers that want to branch/log.) */
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
  )
}
