import { supabase } from "../../lib/supabase"

export type ManagedRole = {
  id: string
  code: string
  name: string
}

export type ManagedUserStatus = "active" | "inactive"
export type ManagedUserFilter = "all" | ManagedUserStatus | "archived"

export type ManagedUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  status: ManagedUserStatus
  lastAccessAt: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  role: ManagedRole
}

export type ManagedUserInput = {
  firstName: string
  lastName: string
  email: string
  roleId: string
  status: ManagedUserStatus
}

type FunctionResult = {
  ok?: boolean
  message?: string
  userId?: string
}

function safeSearchTerm(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s@._+-]/gu, "")
    .trim()
    .slice(0, 80)
}

function normalizeRole(value: unknown): ManagedRole | null {
  const role = Array.isArray(value) ? value[0] : value
  if (!role || typeof role !== "object") return null

  const record = role as Record<string, unknown>
  if (
    typeof record.id !== "string" ||
    typeof record.code !== "string" ||
    typeof record.name !== "string"
  ) {
    return null
  }

  return { id: record.id, code: record.code, name: record.name }
}

function normalizeUserInput(input: ManagedUserInput) {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = input.email.trim().toLowerCase()

  if (firstName.length < 2 || firstName.length > 100) {
    throw new Error("El nombre debe contener entre 2 y 100 caracteres.")
  }
  if (lastName.length > 100) {
    throw new Error("El apellido no puede superar 100 caracteres.")
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error("Ingresa un correo electrónico válido.")
  }
  if (!input.roleId) {
    throw new Error("Selecciona un rol.")
  }
  if (input.status !== "active" && input.status !== "inactive") {
    throw new Error("Selecciona un estado válido.")
  }

  return {
    firstName,
    lastName,
    email,
    roleId: input.roleId,
    status: input.status,
  }
}

function databaseError(error: { code?: string }) {
  if (error.code === "42501")
    return new Error("Tu rol no tiene permiso para consultar usuarios.")
  return new Error("No fue posible consultar los usuarios. Intenta nuevamente.")
}

async function functionError(error: unknown) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const payload = (await context.clone().json()) as { message?: unknown }
        if (typeof payload.message === "string" && payload.message.trim()) {
          return new Error(payload.message)
        }
      } catch {
        // La respuesta no contiene JSON utilizable; se presenta un mensaje seguro.
      }
    }
  }

  return new Error("No fue posible completar la operación. Intenta nuevamente.")
}

async function invokeAdminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<FunctionResult>(
    "admin-users",
    { body },
  )

  if (error) throw await functionError(error)
  if (!data?.ok)
    throw new Error(data?.message || "La operación no pudo completarse.")

  return {
    message: data.message || "Operación completada.",
    userId: data.userId,
  }
}

export async function getUserPage(options: {
  search: string
  page: number
  pageSize: number
  status: ManagedUserFilter
  roleId: string
}): Promise<{ rows: ManagedUser[], count: number }> {
  const safePage = Math.max(0, Math.trunc(options.page))
  const safePageSize = Math.min(50, Math.max(1, Math.trunc(options.pageSize)))
  const from = safePage * safePageSize
  const to = from + safePageSize - 1
  const search = safeSearchTerm(options.search)

  let query = supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, status, last_access_at, created_at, updated_at, archived_at, role:roles!profiles_role_id_fkey(id, code, name)",
      { count: "exact" },
    )

  if (options.status === "archived") {
    query = query.not("archived_at", "is", null)
  } else {
    query = query.is("archived_at", null)
    if (options.status === "active" || options.status === "inactive") {
      query = query.eq("status", options.status)
    }
  }

  if (options.roleId) query = query.eq("role_id", options.roleId)

  if (search) {
    const pattern = `%${search}%`
    query = query.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    )
  }

  const { data, count, error } = await query
    .order(options.status === "archived" ? "archived_at" : "created_at", {
      ascending: false,
    })
    .range(from, to)

  if (error) throw databaseError(error)

  return {
    count: count ?? 0,
    rows: (data ?? []).flatMap((row) => {
      const role = normalizeRole(row.role)
      if (!role) return []
      return [
        {
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          status: row.status,
          lastAccessAt: row.last_access_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          archivedAt: row.archived_at,
          role,
        },
      ]
    }),
  }
}

export async function getAssignableRoles(): Promise<ManagedRole[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name")

  if (error) throw databaseError(error)
  return data ?? []
}

export async function inviteUser(input: ManagedUserInput) {
  return invokeAdminUsers({ action: "invite", ...normalizeUserInput(input) })
}

export async function updateUser(userId: string, input: ManagedUserInput) {
  return invokeAdminUsers({
    action: "update",
    userId,
    ...normalizeUserInput(input),
  })
}

export async function archiveUser(userId: string) {
  return invokeAdminUsers({ action: "archive", userId })
}

export async function restoreUser(userId: string) {
  return invokeAdminUsers({ action: "restore", userId })
}

export async function sendUserPasswordReset(userId: string) {
  return invokeAdminUsers({ action: "send-password-reset", userId })
}
