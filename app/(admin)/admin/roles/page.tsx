import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { RolesShell } from '@/components/admin/roles/roles-shell'
import { roleService } from '@/lib/services/role-service'
import { TEAM_MODULES } from '@/lib/config/team-modules'

export const dynamic = 'force-dynamic'

export default async function AdminRolesPage() {
  await requireTeamModuleAccess('roles')
  const roles = await roleService.listRoles()

  return (
    <RolesShell
      roles={roles}
      modules={TEAM_MODULES.map((m) => ({
        key: m.key,
        section: m.section,
        label: m.label,
        description: m.description,
      }))}
    />
  )
}
