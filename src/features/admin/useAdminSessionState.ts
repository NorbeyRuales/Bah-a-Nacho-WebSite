import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useAuth } from "../auth/AuthProvider"

const STORAGE_PREFIX = "bahia-nacho.admin-state.v1"
const MAX_STORED_BYTES = 64 * 1024
const SESSION_STATE_TTL_MS = 12 * 60 * 60 * 1000

type StoredState = {
  savedAt: number
  value: unknown
}

export type SessionStateParser<T> = (value: unknown) => T | undefined

function storageKey(userId: string, key: string) {
  return `${STORAGE_PREFIX}.${userId}.${key}`
}

function removeStoredState(key: string) {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // El módulo sigue funcionando aunque el almacenamiento esté bloqueado.
  }
}

function readStoredState<T>(
  key: string | null,
  initialValue: T,
  parse: SessionStateParser<T>,
) {
  if (!key || typeof window === "undefined") return initialValue

  try {
    const serialized = window.sessionStorage.getItem(key)
    if (!serialized || serialized.length > MAX_STORED_BYTES) return initialValue

    const stored = JSON.parse(serialized) as StoredState
    const now = Date.now()
    if (
      !stored ||
      typeof stored !== "object" ||
      typeof stored.savedAt !== "number" ||
      stored.savedAt > now + 60_000 ||
      now - stored.savedAt > SESSION_STATE_TTL_MS
    ) {
      removeStoredState(key)
      return initialValue
    }

    return parse(stored.value) ?? initialValue
  } catch {
    removeStoredState(key)
    return initialValue
  }
}

export function useAdminSessionState<T>(
  key: string,
  initialValue: T,
  parse: SessionStateParser<T>,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const { profile } = useAuth()
  const scopedKey = profile ? storageKey(profile.id, key) : null
  const [value, setValue] = useState<T>(() =>
    readStoredState(scopedKey, initialValue, parse),
  )

  useEffect(() => {
    if (!scopedKey) return

    try {
      const serialized = JSON.stringify({ savedAt: Date.now(), value })
      if (serialized.length <= MAX_STORED_BYTES) {
        window.sessionStorage.setItem(scopedKey, serialized)
      }
    } catch {
      // El módulo sigue funcionando aunque el almacenamiento esté bloqueado.
    }
  }, [scopedKey, value])

  const reset = useCallback(() => {
    if (scopedKey) removeStoredState(scopedKey)
    setValue(initialValue)
  }, [initialValue, scopedKey])

  return [value, setValue, reset]
}

export function clearAdminSessionState(userId: string) {
  if (typeof window === "undefined") return
  const userPrefix = `${STORAGE_PREFIX}.${userId}.`

  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith(userPrefix)) window.sessionStorage.removeItem(key)
    }
  } catch {
    // El cierre de sesión no debe fallar si el almacenamiento está bloqueado.
  }
}

export function parseBoundedString(maxLength: number) {
  return (value: unknown) =>
    typeof value === "string" && value.length <= maxLength ? value : undefined
}

export function parseNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined
}
