import {  requireTeamModuleAccess  } from "@/lib/auth/get-user"
import { AnnouncementsShell } from '@/components/admin/announcements/announcements-shell'
import { fetchAnnouncements } from './actions'

export default async function AdminAnnouncementsPage() {
  await requireTeamModuleAccess("announcements")
  const initialData = await fetchAnnouncements({
    search: '',
    status: null,
    view: 'active',
    page: 1,
  })

  return <AnnouncementsShell initialData={initialData} />
}
