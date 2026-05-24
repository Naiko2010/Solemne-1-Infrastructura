import { supabase } from './supabaseClient'
import { getBusinessId } from '../utils/jwt'

const apiBaseUrl = import.meta.env.VITE_API_URL || ''

async function getSession(forceRefresh = false) {
  if (!supabase) {
    throw new Error('Supabase no esta configurado')
  }

  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session?.access_token) {
      throw new Error(error?.message || 'No hay sesion activa')
    }

    return data.session
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(error.message || 'No se pudo obtener la sesion')
  }

  if (data.session?.access_token) {
    return data.session
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshedData.session?.access_token) {
    throw new Error(refreshError?.message || 'No hay sesion activa')
  }

  return refreshedData.session
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}/api${normalizedPath}`
}

/**
 * FastAPI puede devolver detail como string, lista de errores Pydantic u objeto.
 * @param {unknown} detail
 * @returns {string}
 */
export function formatApiErrorDetail(detail) {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const loc = Array.isArray(item.loc) ? item.loc.filter((x) => x !== 'body').join(' › ') : ''
          const msg = item.msg || item.message || ''
          if (loc && msg) return `${loc}: ${msg}`
          if (msg) return msg
        }
        try {
          return JSON.stringify(item)
        } catch {
          return String(item)
        }
      })
      .filter(Boolean)
      .join('\n')
  }
  if (typeof detail === 'object') {
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }
  return String(detail)
}

async function parseErrorResponse(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const json = await response.json()
      const detail = formatApiErrorDetail(json?.detail)
      if (detail) return detail
      if (json && typeof json === 'object' && Object.keys(json).length) {
        return JSON.stringify(json)
      }
      return response.statusText || 'Error desconocido'
    } catch {
      return response.statusText || 'Error desconocido'
    }
  }

  try {
    const text = await response.text()
    return text || response.statusText || 'Error desconocido'
  } catch {
    return response.statusText || 'Error desconocido'
  }
}

export async function getAuthContext() {
  const session = await getSession()
  const token = session.access_token
  const businessId = getBusinessId(session.user, token)

  return {
    token,
    businessId,
    user: session.user,
  }
}

export async function getOptionalAuthContext() {
  if (!supabase) {
    return {
      token: null,
      businessId: null,
      user: null,
    }
  }

  try {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) {
      return {
        token: null,
        businessId: null,
        user: null,
      }
    }

    const token = data.session.access_token

    return {
      token,
      businessId: getBusinessId(data.session.user, token),
      user: data.session.user,
    }
  } catch {
    return {
      token: null,
      businessId: null,
      user: null,
    }
  }
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    token: providedToken,
    headers = {},
    retryOnUnauthorized = true,
  } = options

  const token = providedToken || (await getSession()).access_token

  const makeRequest = async (authToken) => fetch(buildUrl(path), {
    method,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let response = await makeRequest(token)

  if (response.status === 401 && retryOnUnauthorized && supabase) {
    const refreshedSession = await getSession(true)
    response = await makeRequest(refreshedSession.access_token)
  }

  if (!response.ok) {
    const detail = await parseErrorResponse(response)
    const message = detail ? `${response.status}: ${detail}` : `${response.status} ${response.statusText}`
    const err = new Error(message)
    err.status = response.status
    err.detail = detail
    throw err
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return null
  }

  return response.json()
}
