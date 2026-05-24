/**
 * Utilidades RUT Chile: validación, normalización (solo números + K al final)
 * y formato visual con puntos y guión.
 */

/**
 * Solo dígitos y una K final; máximo 9 caracteres si termina en dígito (8 cuerpo + DV)
 * o 8 si termina en K (7–8 cuerpo + K).
 * @param {string} value
 * @returns {string}
 */
export function normalizeRutInput(value) {
  let s = String(value ?? '')
    .toUpperCase()
    .replace(/[^0-9K]/g, '')
  const kIdx = s.indexOf('K')
  if (kIdx !== -1) {
    const before = s
      .slice(0, kIdx)
      .replace(/\D/g, '')
      .slice(0, 8)
    return `${before}K`
  }
  s = s.replace(/\D/g, '')
  if (s.length > 9) return s.slice(0, 9)
  return s
}

function addThousandsDots(digits) {
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Formato solo visual: puntos en el cuerpo y guión antes del verificador (0-9 o K).
 * Entrada ya normalizada (normalizeRutInput).
 * @param {string} normalized
 * @returns {string}
 */
export function formatRutForDisplay(normalized) {
  const n = String(normalized ?? '').toUpperCase()
  if (!n) return ''
  if (n.endsWith('K')) {
    const body = n.slice(0, -1).replace(/\D/g, '')
    if (!body || body.length < 7) return n
    return `${addThousandsDots(body)}-K`
  }
  const d = n.replace(/\D/g, '')
  if (!d) return ''
  if (d.length <= 8) return addThousandsDots(d)
  return `${addThousandsDots(d.slice(0, 8))}-${d[8]}`
}

/**
 * Valida dígito verificador del RUT chileno. Devuelve mensaje de error o null si es válido.
 * Acepta con o sin puntos/guion; K minúscula se normaliza en la limpieza interna.
 * @param {string} value
 * @returns {string | null}
 */
export function validateChileRutMessage(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/-/g, '')
  if (raw.length < 2) return 'Ingresa un RUT válido.'
  const body = raw.slice(0, -1)
  const dvChar = raw.slice(-1)
  if (!/^\d+$/.test(body) || body.length < 7) {
    return 'El cuerpo del RUT debe tener 7 u 8 dígitos antes del verificador.'
  }
  if (!/^[\dK]$/.test(dvChar)) return 'El verificador debe ser un dígito (0-9) o la letra K.'
  const factors = [2, 3, 4, 5, 6, 7]
  let total = 0
  let i = 0
  for (const ch of [...body].reverse()) {
    total += parseInt(ch, 10) * factors[i % 6]
    i += 1
  }
  const rest = 11 - (total % 11)
  const expected = rest === 11 ? '0' : rest === 10 ? 'K' : String(rest)
  if (dvChar !== expected) return 'RUT inválido (dígito verificador incorrecto).'
  return null
}

/**
 * @param {string} phone
 * @returns {string | null} error message or null
 */
export function validateChilePhoneMessage(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return 'El teléfono debe tener entre 8 y 15 dígitos.'
  return null
}
