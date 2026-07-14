import { prisma } from '@/lib/prisma'

export const INVITE_TTL_DAYS = 7
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000

/**
 * Generates a 32-char URL-safe random token. Members never type it —
 * it's only ever clicked from the welcome email, so length favors
 * entropy over readability.
 */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Issue a fresh invite for a user. Any prior unused invites for the
 * same user are marked used so only one live token can exist at a
 * time — clicking an old link after a resend should fail gracefully
 * with the same "invalid or expired" guard.
 *
 * Optionally scope the invite to a specific company (used by the
 * super/create-company flow so the onboarding surface can name the
 * new tenant the owner is being handed). Defaults to the Kondense
 * seed row via the schema-level column default.
 */
export async function issueInvite(
  userId: string,
  options: { companyId?: string } = {},
): Promise<string> {
  const token = generateInviteToken()
  await prisma.$transaction([
    prisma.invite.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.invite.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        ...(options.companyId ? { companyId: options.companyId } : {}),
      },
    }),
  ])
  return token
}
