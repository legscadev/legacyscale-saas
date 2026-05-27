'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncUserToDatabase } from './sync-user'

/** Discriminated result for auth server actions consumed by forms. */
export type AuthActionState =
  | { error: string }
  | { success: true }
  | undefined

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    const dbUser = await syncUserToDatabase(data.user)
    redirect(dbUser.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')
  }

  redirect('/dashboard')
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    await syncUserToDatabase(data.user)
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
