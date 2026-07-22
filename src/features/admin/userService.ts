import { supabase } from '../../lib/supabase'

export type ManagedRole = {
  id: string
  code: string
  name: string
}

export type ManagedUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  status: 'active' | 'inactive'
  lastAccessAt: string | null
  createdAt: string
  role: ManagedRole
}

function safeSearchTerm(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s@._+-]/gu, '')
    .trim()
    .slice(0, 80)
}

function normalizeRole(value: unknown): ManagedRole | null {
  const role = Array.isArray(value) ? value[0] : value
  if (!role || typeof role !== 'object') return null

  const record = role as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.code !== 'string' || typeof record.name !== 'string') {
    return null
  }

  return { id: record.id, code: record.code, name: record.name }
}

export async function getUserPage(options: {
  search: string
  page: number
  pageSize: number
}): Promise<{ rows: ManagedUser[]; count: number }> {
  const from = options.page * options.pageSize
  const to = from + options.pageSize - 1
  const search = safeSearchTerm(options.search)

  let query = supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, email, status, last_access_at, created_at, role:roles!profiles_role_id_fkey(id, code, name)',
      { count: 'exact' },
    )

  if (search) {
    const pattern = `%${search}%`
    query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  return {
    count: count ?? 0,
    rows: (data ?? []).flatMap(row => {
      const role = normalizeRole(row.role)
      if (!role) return []
      return [{
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        status: row.status,
        lastAccessAt: row.last_access_at,
        createdAt: row.created_at,
        role,
      }]
    }),
  }
}

export async function getAssignableRoles(): Promise<ManagedRole[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('id, code, name')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function updateUserAccess(options: {
  userId: string
  roleId: string
  status: 'active' | 'inactive'
}) {
  const { error } = await supabase.rpc('admin_update_user_access', {
    target_user_id: options.userId,
    target_role_id: options.roleId,
    target_status: options.status,
  })

  if (error) throw error
}
