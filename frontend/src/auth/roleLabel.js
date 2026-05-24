/** Label de rol para UI (aplicado en AuthContext al iniciar sesión). */
export function formatRoleLabel(role) {
  if (!role) return 'Usuario'
  return role
    .toString()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/** Coincide con rol superadmin tras formatRoleLabel ("Superadmin") o valor crudo del JWT. */
export function isSuperAdminRole(roleLabel) {
  if (!roleLabel) return false
  const n = String(roleLabel).toLowerCase().replace(/\s+/g, '')
  return n === 'superadmin'
}
