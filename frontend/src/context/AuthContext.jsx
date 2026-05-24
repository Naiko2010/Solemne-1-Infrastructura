import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getUserRole } from '../utils/jwt'
import { WORKER_ROLES } from '../constants/roles'
import { formatRoleLabel } from '../auth/roleLabel'
import { isInventoryAdminRole } from '../utils/inventoryAccess'

const AuthContext = createContext(null)

function clearStoredAuthToken() {
  if (typeof window === 'undefined') return

  const keys = Object.keys(window.localStorage)
  keys.forEach((key) => {
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      window.localStorage.removeItem(key)
    }
  })
}

/**
 * Proveedor raíz de auth: sesión inicial, login, logout y contexto para la app.
 */
export function AppAuthProvider({ children }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [appLoading, setAppLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)

  const clearAuthState = useCallback(() => {
    setUser(null)
    setUserRole(null)
  }, [])

  const clearPreviousSession = useCallback(async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch {
        // Si falla signOut igual forzamos limpieza local para evitar tokens stale.
      }
    }

    clearStoredAuthToken()
    clearAuthState()
  }, [clearAuthState])

  useEffect(() => {
    const checkSession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setTimeout(() => setAppLoading(false), 600)
        return
      }

      const { data, error } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token

      if (error || !accessToken) {
        clearAuthState()
        setTimeout(() => setAppLoading(false), 600)
        return
      }

      const sessionUser = data.session.user
      const roleFromDb = getUserRole(sessionUser, accessToken)

      setUser(sessionUser)
      setUserRole(formatRoleLabel(roleFromDb))
      setTimeout(() => setAppLoading(false), 600)
    }

    checkSession()
  }, [clearAuthState])

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase no esta configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
      return
    }

    if (!email || !password) {
      setErrorMessage('Ingresa correo y contrasena para continuar.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        await clearPreviousSession()
        setErrorMessage(error.message || 'Error de autenticacion')
        return
      }

      const accessToken = data.session?.access_token
      if (!accessToken) {
        await clearPreviousSession()
        setErrorMessage('No se recibio session.access_token al iniciar sesion')
        return
      }

      const sessionUser = data.session?.user || data.user
      if (!sessionUser) {
        await clearPreviousSession()
        setErrorMessage('No se recibio el usuario autenticado en la sesion')
        return
      }

      const userEmail = sessionUser.email ?? email
      const roleFromDb = getUserRole(sessionUser, accessToken)

      setUser(sessionUser)
      setUserRole(formatRoleLabel(roleFromDb))
      setSuccessMessage(`Sesion iniciada como ${userEmail}.`)
    } finally {
      setIsLoading(false)
    }
  }, [email, password, clearPreviousSession])

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut()
      setUser(null)
      setUserRole(null)
      setEmail('')
      setPassword('')
    }
  }, [])

  const value = useMemo(() => {
    const role = userRole ?? null
    return {
      user: user ?? null,
      userRole: role,
      logout,
      isWorker: role != null && WORKER_ROLES.includes(role),
      isInventoryAdmin: isInventoryAdminRole(role),
      appLoading,
      login: {
        email,
        setEmail,
        password,
        setPassword,
        isLoading,
        errorMessage,
        successMessage,
        handleSubmit,
      },
    }
  }, [
    user,
    userRole,
    logout,
    appLoading,
    email,
    password,
    isLoading,
    errorMessage,
    successMessage,
    handleSubmit,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AppAuthProvider')
  }
  return ctx
}

/** Tests / montajes aislados: contexto estático sin Supabase. */
export function AuthProvider({ user, userRole, logout, children }) {
  const role = userRole ?? null
  const value = useMemo(() => ({
    user: user ?? null,
    userRole: role,
    logout,
    isWorker: role != null && WORKER_ROLES.includes(role),
    isInventoryAdmin: isInventoryAdminRole(role),
    appLoading: false,
    login: {
      email: '',
      setEmail: () => {},
      password: '',
      setPassword: () => {},
      isLoading: false,
      errorMessage: '',
      successMessage: '',
      handleSubmit: (event) => event?.preventDefault?.(),
    },
  }), [user, userRole, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
