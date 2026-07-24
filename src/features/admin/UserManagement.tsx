import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  KeyRound,
  LoaderCircle,
  MailPlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react"
import type { UserProfile } from "../auth/AuthProvider"
import { useAuth } from "../auth/AuthProvider"
import {
  archiveUser,
  getAssignableRoles,
  getUserPage,
  inviteUser,
  restoreUser,
  sendUserPasswordReset,
  updateUser,
  type ManagedRole,
  type ManagedUser,
  type ManagedUserFilter,
  type ManagedUserInput,
} from "./userService"

type Feedback = { kind: "success" | "error", text: string }
type ConfirmAction = "archive" | "reset"

const PAGE_SIZE = 20

function formatDate(value: string | null) {
  if (!value) return "Nunca"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No disponible"
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function fullName(user: ManagedUser) {
  return `${user.firstName} ${user.lastName}`.trim() || "Sin nombre registrado"
}

function initials(user: ManagedUser) {
  const value =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
  return value || user.email[0]?.toUpperCase() || "?"
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar ventana"
        onClick={onClose}
        className="absolute inset-0 bg-[#020713]/80 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-dialog-title"
        aria-describedby="user-dialog-description"
        className="relative w-full max-w-lg glass border border-[#1e3a5f] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1e3a5f]">
          <div>
            <h2 id="user-dialog-title" className="text-white font-semibold">
              {title}
            </h2>
            <p
              id="user-dialog-description"
              className="text-[#64748b] text-xs mt-1"
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 text-[#64748b] hover:text-white rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

function UserFormDialog({
  user,
  roles,
  currentUserId,
  onClose,
  onSaved,
}: {
  user: ManagedUser | null
  roles: ManagedRole[]
  currentUserId: string
  onClose: () => void
  onSaved: (feedback: Feedback, updatedCurrentUser: boolean) => void
}) {
  const isEditing = user !== null
  const isCurrentUser = user?.id === currentUserId
  const [form, setForm] = useState<ManagedUserInput>({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    roleId: user?.role.id ?? roles[0]?.id ?? "",
    status: user?.status ?? "active",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = <K extends keyof ManagedUserInput,>(
    field: K,
    value: ManagedUserInput[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)

    try {
      const result = user
        ? await updateUser(user.id, form)
        : await inviteUser(form)
      onSaved({ kind: "success", text: result.message }, Boolean(isCurrentUser))
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar el usuario.",
      )
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full bg-[#081426] border border-[#1e3a5f] focus:border-[#1565ff] rounded-lg px-3 py-2.5 text-sm text-white outline-none disabled:opacity-60"
  const labelClass = "block text-xs font-medium text-[#93c5fd] mb-1.5"

  return (
    <ModalShell
      title={isEditing ? "Editar usuario" : "Crear usuario"}
      description={
        isEditing
          ? "Actualiza la identidad, el rol y el acceso de la cuenta."
          : "Se enviará una invitación segura para que el usuario defina su contraseña."
      }
      onClose={saving ? () => undefined : onClose}
    >
      <form onSubmit={submit}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label>
            <span className={labelClass}>Nombre *</span>
            <input
              autoFocus
              required
              minLength={2}
              maxLength={100}
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) => setField("firstName", event.target.value)}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Apellido</span>
            <input
              maxLength={100}
              autoComplete="family-name"
              value={form.lastName}
              onChange={(event) => setField("lastName", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Correo electrónico *</span>
            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Rol *</span>
            <select
              required
              value={form.roleId}
              onChange={(event) => setField("roleId", event.target.value)}
              disabled={Boolean(isCurrentUser)}
              className={inputClass}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Estado *</span>
            <select
              value={form.status}
              onChange={(event) =>
                setField(
                  "status",
                  event.target.value as ManagedUserInput["status"],
                )
              }
              disabled={Boolean(isCurrentUser)}
              className={inputClass}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </label>
          {isCurrentUser && (
            <div className="sm:col-span-2 flex items-start gap-2 text-[#64748b] text-xs">
              <Info size={14} className="mt-0.5 shrink-0" />
              Puedes actualizar tus datos, pero tu rol y estado están
              protegidos.
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="sm:col-span-2 flex items-start gap-2 text-red-300 text-xs bg-red-950/30 border border-red-900/60 rounded-lg p-3"
            >
              <AlertTriangle size={15} className="shrink-0" /> {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 bg-[#081426]/70 border-t border-[#1e3a5f]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-[#93c5fd] hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || roles.length === 0}
            className="inline-flex items-center gap-2 bg-[#1565ff] hover:bg-[#1252d3] disabled:opacity-50 px-4 py-2 rounded-lg text-sm text-white"
          >
            {saving ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : isEditing ? (
              <CheckCircle2 size={15} />
            ) : (
              <MailPlus size={15} />
            )}
            {saving
              ? "Guardando…"
              : isEditing
                ? "Guardar cambios"
                : "Crear e invitar"}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ConfirmDialog({
  user,
  action,
  onClose,
  onConfirmed,
}: {
  user: ManagedUser
  action: ConfirmAction
  onClose: () => void
  onConfirmed: (feedback: Feedback) => void
}) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isArchive = action === "archive"

  const confirm = async () => {
    if (processing) return
    setProcessing(true)
    setError(null)
    try {
      const result = isArchive
        ? await archiveUser(user.id)
        : await sendUserPasswordReset(user.id)
      onConfirmed({ kind: "success", text: result.message })
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No fue posible completar la acción.",
      )
    } finally {
      setProcessing(false)
    }
  }

  return (
    <ModalShell
      title={isArchive ? "Eliminar usuario" : "Restablecer contraseña"}
      description={
        isArchive
          ? "La baja será reversible y conservará todas las referencias históricas."
          : "Supabase enviará un enlace de restablecimiento al correo de la cuenta."
      }
      onClose={processing ? () => undefined : onClose}
    >
      <div className="p-5">
        <div className="flex items-center gap-3 rounded-xl bg-[#081426] border border-[#1e3a5f] p-4">
          <div className="w-10 h-10 rounded-full bg-[#1565ff]/20 text-[#93c5fd] flex items-center justify-center font-semibold">
            {initials(user)}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">
              {fullName(user)}
            </div>
            <div className="text-[#64748b] text-xs truncate">{user.email}</div>
          </div>
        </div>
        <p className="text-[#93c5fd] text-sm mt-4">
          {isArchive
            ? "El usuario perderá el acceso inmediatamente y quedará disponible en el filtro Archivados."
            : "¿Deseas enviar el correo de restablecimiento ahora?"}
        </p>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 text-red-300 text-xs bg-red-950/30 border border-red-900/60 rounded-lg p-3 mt-4"
          >
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 px-5 py-4 bg-[#081426]/70 border-t border-[#1e3a5f]">
        <button
          type="button"
          onClick={onClose}
          disabled={processing}
          className="px-4 py-2 text-sm text-[#93c5fd] hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={processing}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50 ${
            isArchive
              ? "bg-red-600 hover:bg-red-500"
              : "bg-[#1565ff] hover:bg-[#1252d3]"
          }`}
        >
          {processing ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : isArchive ? (
            <Trash2 size={15} />
          ) : (
            <KeyRound size={15} />
          )}
          {processing
            ? "Procesando…"
            : isArchive
              ? "Eliminar usuario"
              : "Enviar enlace"}
        </button>
      </div>
    </ModalShell>
  )
}

export function UserManagement({ currentUser }: { currentUser: UserProfile }) {
  const { refreshProfile } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [roles, setRoles] = useState<ManagedRole[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ManagedUserFilter>("all")
  const [roleFilter, setRoleFilter] = useState("")
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rolesLoading, setRolesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [formUser, setFormUser] = useState<ManagedUser | "new" | null>(null)
  const [confirmState, setConfirmState] = useState<{
    user: ManagedUser
    action: ConfirmAction
  } | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const canManage = currentUser.permissions.includes("users.manage")

  useEffect(() => {
    let active = true
    setRolesLoading(true)
    void getAssignableRoles()
      .then((availableRoles) => {
        if (active) setRoles(availableRoles)
      })
      .catch((roleError) => {
        if (active)
          setError(
            roleError instanceof Error
              ? roleError.message
              : "No fue posible cargar los roles.",
          )
      })
      .finally(() => {
        if (active) setRolesLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void getUserPage({
        search,
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter,
        roleId: roleFilter,
      })
        .then((userPage) => {
          if (!active) return
          setUsers(userPage.rows)
          setCount(userPage.count)
        })
        .catch((loadError) => {
          if (active)
            setError(
              loadError instanceof Error
                ? loadError.message
                : "No fue posible consultar los usuarios.",
            )
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, reloadKey, roleFilter, search, statusFilter])

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1))
  }, [page, totalPages])

  const changeFilter = (
    nextStatus: ManagedUserFilter,
    nextRole = roleFilter,
  ) => {
    setStatusFilter(nextStatus)
    setRoleFilter(nextRole)
    setPage(0)
    setFeedback(null)
  }

  const handleSaved = (nextFeedback: Feedback, updatedCurrentUser: boolean) => {
    setFormUser(null)
    setFeedback(nextFeedback)
    setReloadKey((value) => value + 1)
    if (updatedCurrentUser) void refreshProfile()
  }

  const handleConfirmed = (nextFeedback: Feedback) => {
    setConfirmState(null)
    setFeedback(nextFeedback)
    setReloadKey((value) => value + 1)
  }

  const restore = async (user: ManagedUser) => {
    if (restoringId) return
    setRestoringId(user.id)
    setFeedback(null)
    try {
      const result = await restoreUser(user.id)
      setFeedback({ kind: "success", text: result.message })
      setReloadKey((value) => value + 1)
    } catch (restoreError) {
      setFeedback({
        kind: "error",
        text:
          restoreError instanceof Error
            ? restoreError.message
            : "No fue posible restaurar el usuario.",
      })
    } finally {
      setRestoringId(null)
    }
  }

  const selectClass =
    "glass border border-[#1e3a5f] bg-[#081426] px-3 py-2.5 text-sm text-white rounded-lg outline-none focus:border-[#1565ff]"

  return (
    <div className="space-y-4">
      <div className="glass border border-[#1e3a5f] rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck
          size={19}
          className="text-[#00b4d8] mt-0.5 flex-shrink-0"
        />
        <div>
          <h2 className="text-white font-semibold text-sm">
            Administración segura de acceso
          </h2>
          <p className="text-[#64748b] text-xs mt-1 leading-relaxed">
            Crea cuentas por invitación, administra identidades y asigna roles.
            Las contraseñas permanecen exclusivamente en Supabase Auth.
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
                setFeedback(null)
              }}
              maxLength={80}
              placeholder="Buscar por nombre o correo…"
              aria-label="Buscar usuarios"
              className="w-full glass border border-[#1e3a5f] focus:border-[#1565ff] bg-transparent pl-9 pr-3 py-2.5 text-white placeholder-[#64748b] rounded-lg text-sm outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) =>
              changeFilter(event.target.value as ManagedUserFilter)
            }
            aria-label="Filtrar por estado"
            className={selectClass}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="archived">Archivados</option>
          </select>
          <select
            value={roleFilter}
            onChange={(event) => changeFilter(statusFilter, event.target.value)}
            disabled={rolesLoading}
            aria-label="Filtrar por rol"
            className={`${selectClass} disabled:opacity-50`}
          >
            <option value="">Todos los roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setReloadKey((value) => value + 1)
              setFeedback(null)
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 text-[#93c5fd] hover:text-white px-3 py-2.5 text-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />{" "}
            Actualizar
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setFormUser("new")}
              disabled={rolesLoading || roles.length === 0}
              className="inline-flex items-center justify-center gap-2 bg-[#1565ff] hover:bg-[#1252d3] disabled:opacity-50 px-4 py-2.5 rounded-lg text-sm text-white"
            >
              <Plus size={16} /> Nuevo usuario
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`border rounded-xl px-4 py-3 flex items-start gap-3 text-sm ${
            feedback.kind === "success"
              ? "bg-green-950/20 border-green-800/70 text-green-300"
              : "bg-red-950/20 border-red-800/70 text-red-300"
          }`}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 size={17} />
          ) : (
            <AlertTriangle size={17} />
          )}
          <span className="flex-1">{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Cerrar mensaje"
            className="opacity-70 hover:opacity-100"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="glass border border-red-800/70 rounded-xl px-4 py-3 flex items-center gap-3 text-red-300 text-sm"
        >
          <AlertTriangle size={17} /> {error}
        </div>
      )}

      <div className="glass border border-[#1e3a5f] rounded-xl overflow-hidden">
        {loading ? (
          <div
            className="min-h-64 flex items-center justify-center gap-3 text-[#93c5fd] text-sm"
            role="status"
          >
            <LoaderCircle size={18} className="animate-spin text-[#1565ff]" />{" "}
            Consultando usuarios…
          </div>
        ) : users.length === 0 ? (
          <div className="min-h-64 flex flex-col items-center justify-center text-[#64748b] text-sm px-4 text-center">
            <UserRoundCog size={34} className="opacity-40 mb-2" />
            {statusFilter === "archived"
              ? "No hay usuarios archivados."
              : "No hay usuarios para estos filtros."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a1628] border-b border-[#1e3a5f]">
                  {[
                    "Usuario",
                    "Rol",
                    "Estado",
                    "Último acceso",
                    "Creado",
                    "Acciones",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs text-[#64748b] font-medium"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUser.id
                  const isArchived = Boolean(user.archivedAt)
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-[#1e3a5f]/60 last:border-b-0 hover:bg-white/[0.015]"
                    >
                      <td className="px-4 py-3 min-w-64">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1565ff]/15 text-[#93c5fd] flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials(user)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-white text-sm truncate">
                              {fullName(user)}
                            </div>
                            <div className="text-[#64748b] text-xs mt-0.5 truncate">
                              {user.email}
                            </div>
                            {isCurrentUser && (
                              <div className="text-[#00b4d8] text-[11px] mt-0.5">
                                Tu cuenta
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-40">
                        <span className="inline-flex rounded-full bg-[#1565ff]/10 border border-[#1565ff]/20 px-2.5 py-1 text-xs text-[#93c5fd]">
                          {user.role.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-32">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                            isArchived
                              ? "bg-slate-800/50 border-slate-600/40 text-slate-400"
                              : user.status === "active"
                                ? "bg-green-950/30 border-green-700/40 text-green-400"
                                : "bg-amber-950/30 border-amber-700/40 text-amber-400"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {isArchived
                            ? "Archivado"
                            : user.status === "active"
                              ? "Activo"
                              : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748b] text-xs min-w-40">
                        {formatDate(user.lastAccessAt)}
                      </td>
                      <td className="px-4 py-3 text-[#64748b] text-xs min-w-40">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 min-w-40">
                        {canManage ? (
                          <div className="flex items-center gap-1">
                            {isArchived ? (
                              <button
                                type="button"
                                onClick={() => void restore(user)}
                                disabled={restoringId === user.id}
                                title="Restaurar usuario"
                                aria-label={`Restaurar a ${user.email}`}
                                className="p-2 rounded-lg text-green-400 hover:text-green-300 hover:bg-green-500/10 disabled:opacity-50"
                              >
                                {restoringId === user.id ? (
                                  <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <ArchiveRestore size={16} />
                                )}
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormUser(user)}
                                  title="Editar usuario"
                                  aria-label={`Editar a ${user.email}`}
                                  className="p-2 rounded-lg text-[#93c5fd] hover:text-white hover:bg-white/5"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmState({ user, action: "reset" })
                                  }
                                  title="Restablecer contraseña"
                                  aria-label={`Restablecer contraseña de ${user.email}`}
                                  className="p-2 rounded-lg text-[#93c5fd] hover:text-white hover:bg-white/5"
                                >
                                  <KeyRound size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmState({ user, action: "archive" })
                                  }
                                  disabled={isCurrentUser}
                                  title={
                                    isCurrentUser
                                      ? "Tu cuenta está protegida"
                                      : "Eliminar usuario"
                                  }
                                  aria-label={`Eliminar a ${user.email}`}
                                  className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#64748b] text-xs">
                            Solo lectura
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e3a5f] text-xs text-[#64748b]">
          <span>
            {count} {count === 1 ? "usuario" : "usuarios"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30"
              aria-label="Página anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((value) => Math.min(totalPages - 1, value + 1))
              }
              disabled={page >= totalPages - 1 || count === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30"
              aria-label="Página siguiente"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[#64748b] text-xs">
        <Info size={14} className="mt-0.5 flex-shrink-0" />
        La eliminación es una baja lógica reversible. Tu propia cuenta y el
        último administrador activo están protegidos.
      </div>

      {formUser && (
        <UserFormDialog
          user={formUser === "new" ? null : formUser}
          roles={roles}
          currentUserId={currentUser.id}
          onClose={() => setFormUser(null)}
          onSaved={handleSaved}
        />
      )}
      {confirmState && (
        <ConfirmDialog
          user={confirmState.user}
          action={confirmState.action}
          onClose={() => setConfirmState(null)}
          onConfirmed={handleConfirmed}
        />
      )}
    </div>
  )
}
