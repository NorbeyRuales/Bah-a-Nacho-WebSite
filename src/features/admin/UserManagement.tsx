import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Info, LoaderCircle, RefreshCw, Save, Search, ShieldCheck, UserRoundCog } from 'lucide-react'
import type { UserProfile } from '../auth/AuthProvider'
import {
  getAssignableRoles,
  getUserPage,
  updateUserAccess,
  type ManagedRole,
  type ManagedUser,
} from './userService'

function formatDate(value: string | null) {
  if (!value) return 'Nunca'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No disponible'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function UserAccessRow({
  user,
  roles,
  currentUserId,
  onSaved,
}: {
  user: ManagedUser
  roles: ManagedRole[]
  currentUserId: string
  onSaved: () => void
}) {
  const [roleId, setRoleId] = useState(user.role.id)
  const [status, setStatus] = useState(user.status)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const isCurrentUser = user.id === currentUserId
  const changed = roleId !== user.role.id || status !== user.status

  const save = async () => {
    if (!changed || saving || isCurrentUser) return
    setSaving(true)
    setMessage(null)
    try {
      await updateUserAccess({ userId: user.id, roleId, status })
      setMessage({ kind: 'success', text: 'Acceso actualizado.' })
      onSaved()
    } catch {
      setMessage({ kind: 'error', text: 'No fue posible actualizar el acceso.' })
    } finally {
      setSaving(false)
    }
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'Sin nombre registrado'

  return (
    <tr className="border-b border-[#1e3a5f]/60 align-top">
      <td className="px-4 py-3 min-w-56">
        <div className="font-medium text-white text-sm">{fullName}</div>
        <div className="text-[#64748b] text-xs mt-1">{user.email}</div>
        {isCurrentUser && <div className="text-[#00b4d8] text-xs mt-1">Tu cuenta</div>}
      </td>
      <td className="px-4 py-3 min-w-44">
        <select
          value={roleId}
          onChange={event => { setRoleId(event.target.value); setMessage(null) }}
          disabled={isCurrentUser || saving}
          aria-label={`Rol de ${user.email}`}
          className="w-full bg-[#081426] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </td>
      <td className="px-4 py-3 min-w-36">
        <select
          value={status}
          onChange={event => { setStatus(event.target.value as 'active' | 'inactive'); setMessage(null) }}
          disabled={isCurrentUser || saving}
          aria-label={`Estado de ${user.email}`}
          className="w-full bg-[#081426] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </td>
      <td className="px-4 py-3 text-[#64748b] text-xs min-w-40">{formatDate(user.lastAccessAt)}</td>
      <td className="px-4 py-3 min-w-44">
        <button
          type="button"
          onClick={save}
          disabled={!changed || isCurrentUser || saving}
          className="inline-flex items-center gap-2 bg-[#1565ff] hover:bg-[#1252d3] disabled:opacity-35 px-3 py-2 rounded-lg text-xs text-white"
        >
          {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
        {message && (
          <div className={`flex items-center gap-1 text-xs mt-2 ${message.kind === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {message.kind === 'success' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
            {message.text}
          </div>
        )}
      </td>
    </tr>
  )
}

export function UserManagement({ currentUser }: { currentUser: UserProfile }) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [roles, setRoles] = useState<ManagedRole[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void Promise.all([
        getUserPage({ search, page, pageSize }),
        getAssignableRoles(),
      ]).then(([userPage, availableRoles]) => {
        if (!active) return
        setUsers(userPage.rows)
        setCount(userPage.count)
        setRoles(availableRoles)
      }).catch(() => {
        if (active) setError('No fue posible consultar los usuarios y roles.')
      }).finally(() => {
        if (active) setLoading(false)
      })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, reloadKey, search])

  return (
    <div className="space-y-4">
      <div className="glass border border-[#1e3a5f] rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck size={19} className="text-[#00b4d8] mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="text-white font-semibold text-sm">Administración segura de acceso</h2>
          <p className="text-[#64748b] text-xs mt-1 leading-relaxed">
            Aquí puedes asignar roles y activar o desactivar cuentas. Las credenciales se crean en Supabase Auth para que ninguna contraseña pase por este panel.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
          <input
            type="search"
            value={search}
            onChange={event => { setSearch(event.target.value); setPage(0) }}
            maxLength={80}
            placeholder="Buscar por nombre o correo…"
            className="w-full glass border border-[#1e3a5f] focus:border-[#1565ff] bg-transparent pl-9 pr-3 py-2.5 text-white placeholder-[#64748b] rounded-lg text-sm outline-none"
          />
        </div>
        <button type="button" onClick={() => setReloadKey(value => value + 1)} disabled={loading} className="inline-flex items-center justify-center gap-2 text-[#93c5fd] hover:text-white px-3 py-2 text-sm disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {error && (
        <div role="alert" className="glass border border-red-800/70 rounded-xl px-4 py-3 flex items-center gap-3 text-red-300 text-sm">
          <AlertTriangle size={17} /> {error}
        </div>
      )}

      <div className="glass border border-[#1e3a5f] rounded-xl overflow-hidden">
        {loading ? (
          <div className="min-h-56 flex items-center justify-center gap-3 text-[#93c5fd] text-sm" role="status">
            <LoaderCircle size={18} className="animate-spin text-[#1565ff]" /> Consultando usuarios…
          </div>
        ) : users.length === 0 ? (
          <div className="min-h-56 flex flex-col items-center justify-center text-[#64748b] text-sm">
            <UserRoundCog size={32} className="opacity-40 mb-2" /> No hay usuarios para este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a1628] border-b border-[#1e3a5f]">
                  {['Usuario', 'Rol', 'Estado', 'Último acceso', 'Acción'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs text-[#64748b] font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <UserAccessRow
                    key={`${user.id}-${user.role.id}-${user.status}`}
                    user={user}
                    roles={roles}
                    currentUserId={currentUser.id}
                    onSaved={() => setReloadKey(value => value + 1)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e3a5f] text-xs text-[#64748b]">
          <span>{count} usuarios</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30" aria-label="Página anterior">
              <ChevronLeft size={14} />
            </button>
            <span>Página {page + 1} de {totalPages}</span>
            <button type="button" onClick={() => setPage(value => Math.min(totalPages - 1, value + 1))} disabled={page >= totalPages - 1 || count === 0} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30" aria-label="Página siguiente">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[#64748b] text-xs">
        <Info size={14} className="mt-0.5 flex-shrink-0" /> Tu propia cuenta se protege contra cambios de rol o desactivación para evitar perder el acceso administrativo.
      </div>
    </div>
  )
}
