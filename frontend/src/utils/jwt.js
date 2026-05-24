/**
 * Decodifica un JWT y extrae sus claims
 * @param {string} token - Token JWT
 * @returns {object} Claims del token
 */
export function decodeJWT(token) {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Token invalido')
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Token invalido')
    }

    const payload = parts[1]
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=')
    const decoded = JSON.parse(atob(paddedPayload))
    return decoded
  } catch (error) {
    console.error('Error decodificando JWT:', error)
    return null
  }
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return null
}

/**
 * Extrae el business_id del JWT de Supabase
 * @param {string} token - Token JWT
 * @returns {string|null} business_id o null si no existe
 */
export function getBusinessIdFromToken(token) {
  const claims = decodeJWT(token)

  const businessId = pickFirstNonEmpty(
    claims?.app_metadata?.business_id,
    claims?.user_metadata?.business_id,
    claims?.business_id,
  )

  return businessId
}

/**
 * Extrae el business_id desde el usuario de sesión y, como fallback, desde el JWT.
 * Se prioriza app_metadata sobre user_metadata.
 * @param {object|null} user - Usuario autenticado de Supabase
 * @param {string|null} token - JWT de acceso
 * @returns {string|null}
 */
export function getBusinessId(user, token) {
  const claims = token ? decodeJWT(token) : null

  return pickFirstNonEmpty(
    user?.app_metadata?.business_id,
    user?.user_metadata?.business_id,
    claims?.app_metadata?.business_id,
    claims?.user_metadata?.business_id,
    claims?.business_id,
  )
}

/**
 * Extrae el rol del usuario desde user metadata, app metadata o claims del token.
 * @param {object|null} user - Usuario de Supabase
 * @param {string|null} token - JWT de acceso
 * @returns {string|null} rol detectado
 */
export function getUserRole(user, token) {
  const claims = token ? decodeJWT(token) : null

  const role = pickFirstNonEmpty(
    user?.app_metadata?.role,
    user?.app_metadata?.user_role,
    user?.user_metadata?.role,
    user?.user_metadata?.user_role,
    claims?.app_metadata?.role,
    claims?.app_metadata?.user_role,
    claims?.user_metadata?.role,
    claims?.user_metadata?.user_role,
    claims?.role,
  )

  return role
}
