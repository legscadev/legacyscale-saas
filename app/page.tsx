import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { LandingPage } from '@/components/marketing/landing-page'

export default async function HomePage() {
  const user = await getUser()

  if (user) {
    redirect(user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')
  }

  return <LandingPage />
}
