import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Limpiar después de cada prueba
afterEach(() => {
  cleanup()
})

// Mock de variables de entorno
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_API_URL: 'http://localhost:8000',
    },
  },
})

// Mock de fetch si es necesario
if (!global.fetch) {
  global.fetch = vi.fn()
}
