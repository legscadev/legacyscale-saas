import { getUser } from '@/lib/auth'
import {
  forbiddenResponse,
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
} from '@/lib/api/helpers'
import { dashboardService } from '@/lib/services/dashboard-service'

export const GET = withErrorHandling(async () => {
  // JSON consumers get a 401/403 instead of a redirect — the page
  // version uses requireActiveUser(), but that throws NEXT_REDIRECT
  // which lands as a 307 to /login and breaks fetch clients.
  const user = await getUser()
  if (!user) return unauthorizedResponse()
  if (!user.isActive) return forbiddenResponse('Account paused')

  const data = await dashboardService.getMemberDashboard(user.id)
  return successResponse(data)
})
