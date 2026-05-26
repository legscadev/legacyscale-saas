import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.json({
    id: user.id,
    authId: user.authId,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  })
}
