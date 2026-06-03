import { cookies } from 'next/headers'

import { ResetPasswordContent } from './reset-password-content'

// Cookie set by /auth/confirm when the user clicks a recovery link.
// We don't burn the underlying Supabase token until they submit a new
// password — see lib/auth/actions.ts updatePassword.
const PW_RESET_COOKIE = 'pw_reset_token'

export default async function ResetPasswordPage() {
  const cookieStore = await cookies()
  const hasToken = !!cookieStore.get(PW_RESET_COOKIE)?.value
  return <ResetPasswordContent hasToken={hasToken} />
}
