import { describe, it, expect } from 'vitest'
import {
  formatRutForDisplay,
  normalizeRutInput,
  validateChilePhoneMessage,
  validateChileRutMessage,
} from './chileRut'

describe('normalizeRutInput', () => {
  it('deja solo dígitos y K final', () => {
    expect(normalizeRutInput('12.345.678-5')).toBe('123456785')
  })

  it('acepta k minúscula como K', () => {
    expect(normalizeRutInput('1000005k')).toBe('1000005K')
  })

  it('limita longitud con dígito verificador', () => {
    expect(normalizeRutInput('1234567890')).toBe('123456789')
  })
})

describe('formatRutForDisplay', () => {
  it('agrega puntos y guión (8+1 dígitos)', () => {
    expect(formatRutForDisplay('123456785')).toBe('12.345.678-5')
  })

  it('solo puntos en cuerpo de 8 dígitos sin DV aún', () => {
    expect(formatRutForDisplay('20727946')).toBe('20.727.946')
  })

  it('formatea verificador K', () => {
    expect(formatRutForDisplay('1000005K')).toBe('1.000.005-K')
  })
})

describe('validateChileRutMessage', () => {
  it('acepta RUT válido con formato', () => {
    expect(validateChileRutMessage('12.345.678-5')).toBeNull()
  })

  it('acepta RUT sin puntos', () => {
    expect(validateChileRutMessage('123456785')).toBeNull()
  })

  it('acepta verificador K cuando corresponde', () => {
    expect(validateChileRutMessage('1000005K')).toBeNull()
    expect(validateChileRutMessage('1.000.005-k')).toBeNull()
  })

  it('rechaza DV incorrecto', () => {
    expect(validateChileRutMessage('12.345.678-0')).toMatch(/verificador/i)
  })
})

describe('validateChilePhoneMessage', () => {
  it('acepta teléfono con dígitos suficientes', () => {
    expect(validateChilePhoneMessage('+56 9 1234 5678')).toBeNull()
  })

  it('rechaza corto', () => {
    expect(validateChilePhoneMessage('123')).toMatch(/8 y 15/)
  })
})
