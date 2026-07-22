import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export type UserRole = {
  id: string
  code: string
  name: string
}

export type UserProfile = {
  id: string
  firstName: string
  lastName: string
  email: string
  status: 'active' | 'inactive'
  lastAccessAt: string | null
  role: UserRole
  permissions: string[]
}

type SignInResult = { error: string | null }

type AuthContextValue = {
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  authError: string | null
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeRole(role: unknown): UserRole | null {
  const value = Array.isArray(role) ? role[0] : role
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.code !== 'string' || typeof record.name !== 'string') {
    return null
  }

  return { id: record.id, code: record.code, name: record.name }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    const [{ data, error }, { data: permissionsData, error: permissionsError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, first_name, last_name, email, status, last_access_at, role:roles!profiles_role_id_fkey(id, code, name)')
        .eq('id', userId)
        .single(),
      supabase.rpc('current_permissions'),
    ])

    if (error || permissionsError || !data) {
      setProfile(null)
      setAuthError('La sesión existe, pero no fue posible cargar el perfil autorizado.')
      return
    }

    const role = normalizeRole(data.role)
    if (!role) {
      setProfile(null)
      setAuthError('El usuario no tiene un rol válido asignado.')
      return
    }

    if (data.status !== 'active') {
      setProfile(null)
      setAuthError('El usuario está inactivo. Contacta a un administrador.')
      return
    }

    setProfile({
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      status: data.status,
      lastAccessAt: data.last_access_at,
      role,
      permissions: Array.isArray(permissionsData)
        ? permissionsData.filter((permission): permission is string => typeof permission === 'string')
        : [],
    })
    setAuthError(null)

    await supabase.rpc('touch_last_access')
  }, [])

  useEffect(() => {
    let active = true

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        setAuthError('No fue posible restaurar la sesión de forma segura.')
        setLoading(false)
        return
      }

      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      if (active) setLoading(false)
    }

    void initialize()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)

      if (!nextSession) {
        setProfile(null)
        setAuthError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      window.setTimeout(() => {
        void loadProfile(nextSession.user.id).finally(() => {
          if (active) setLoading(false)
        })
      }, 0)
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error || !data.session) {
      return { error: 'No fue posible iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.' }
    }

    setSession(data.session)
    await loadProfile(data.session.user.id)
    return { error: null }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setAuthError(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    setLoading(true)
    await loadProfile(session.user.id)
    setLoading(false)
  }, [loadProfile, session])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    profile,
    loading,
    authError,
    signIn,
    signOut,
    refreshProfile,
  }), [authError, loading, profile, refreshProfile, session, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.')
  return context
}
