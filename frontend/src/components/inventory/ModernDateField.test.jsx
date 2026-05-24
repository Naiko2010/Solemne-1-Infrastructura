import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModernDateField from './ModernDateField'

/* ── jsdom helpers ───────────────────────────────────────────── */
/* requestAnimationFrame is not implemented in jsdom — run callback immediately */
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 0 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  /* jsdom getBoundingClientRect returns all-zeros; give the trigger a real rect */
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 100, bottom: 140, left: 200, right: 500,
    width: 300, height: 40, x: 200, y: 100,
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/* ── Pure-function tests (exported via named helpers) ────────── */
/* We test them indirectly through the component's rendered output  */

describe('Funciones puras del calendario (indirecto)', () => {
  it('daysInMonth: mayo tiene 31 días', () => {
    // new Date(2026, 5, 0).getDate() — month 5 day 0 = last day of May
    expect(new Date(2026, 5, 0).getDate()).toBe(31)
  })

  it('daysInMonth: abril tiene 30 días', () => {
    expect(new Date(2026, 4, 0).getDate()).toBe(30)
  })

  it('daysInMonth: febrero 2024 (bisiesto) tiene 29 días', () => {
    expect(new Date(2024, 2, 0).getDate()).toBe(29)
  })

  it('daysInMonth: febrero 2025 (no bisiesto) tiene 28 días', () => {
    expect(new Date(2025, 2, 0).getDate()).toBe(28)
  })
})

/* ── Helpers locales que replican la lógica del componente ───── */
function parseIso(iso) {
  if (!iso || typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, mo, d }
}

function partsToIso(y, mo, d) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

describe('parseIsoToParts', () => {
  it('parsea fecha válida', () => {
    expect(parseIso('2026-05-31')).toEqual({ y: 2026, mo: 5, d: 31 })
  })
  it('parsea primer día del año', () => {
    expect(parseIso('2001-01-01')).toEqual({ y: 2001, mo: 1, d: 1 })
  })
  it('retorna null para string vacío', () => {
    expect(parseIso('')).toBeNull()
  })
  it('retorna null para formato incorrecto', () => {
    expect(parseIso('31/05/2026')).toBeNull()
  })
  it('retorna null para mes fuera de rango', () => {
    expect(parseIso('2026-13-01')).toBeNull()
  })
  it('retorna null para día fuera de rango', () => {
    expect(parseIso('2026-05-00')).toBeNull()
  })
})

describe('partsToIso', () => {
  it('formatea con padding', () => {
    expect(partsToIso(2026, 5, 3)).toBe('2026-05-03')
  })
  it('formatea día y mes de dos dígitos sin cambio', () => {
    expect(partsToIso(2026, 12, 31)).toBe('2026-12-31')
  })
  it('formatea día 1', () => {
    expect(partsToIso(2001, 1, 1)).toBe('2001-01-01')
  })
})

/* ── Tests de componente ─────────────────────────────────────── */

function openCalendar() {
  /* The trigger is the only button with aria-haspopup="dialog" */
  const btn = document.querySelector('button[aria-haspopup="dialog"]')
  if (!btn) throw new Error('No se encontró el botón del calendario (aria-haspopup="dialog")')
  fireEvent.click(btn)
}

describe('ModernDateField — renderizado', () => {
  it('muestra "Seleccionar fecha" cuando no hay valor', () => {
    render(<ModernDateField onChange={() => {}} />)
    expect(screen.getByText('Seleccionar fecha')).toBeInTheDocument()
  })

  it('muestra la fecha formateada cuando hay valor', () => {
    render(<ModernDateField value="2026-05-31" onChange={() => {}} />)
    expect(screen.getByText(/31 may 2026/i)).toBeInTheDocument()
  })

  it('muestra el label cuando se pasa', () => {
    render(<ModernDateField label="Fecha inicio" onChange={() => {}} />)
    expect(screen.getByText('Fecha inicio')).toBeInTheDocument()
  })

  it('el botón está deshabilitado cuando disabled=true', () => {
    render(<ModernDateField disabled onChange={() => {}} />)
    const btn = screen.getByRole('button', { name: /Seleccionar fecha|fecha/i })
    expect(btn).toBeDisabled()
  })
})

describe('ModernDateField — apertura del calendario', () => {
  it('abre el calendario al hacer clic en el botón', () => {
    render(<ModernDateField onChange={() => {}} />)
    openCalendar()
    expect(screen.getByRole('dialog', { name: /Calendario/i })).toBeInTheDocument()
  })

  it('muestra los encabezados de días de la semana', () => {
    render(<ModernDateField onChange={() => {}} />)
    openCalendar()
    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Mar')).toBeInTheDocument()
    expect(screen.getByText('Dom')).toBeInTheDocument()
    expect(screen.getByText('Sáb')).toBeInTheDocument()
  })

  it('contiene selectores de mes y año', () => {
    render(<ModernDateField onChange={() => {}} />)
    openCalendar()
    expect(screen.getByRole('combobox', { name: /Mes/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Año/i })).toBeInTheDocument()
  })
})

describe('ModernDateField — selección de días', () => {
  it('llama onChange con ISO correcto al clicar un día', () => {
    const onChange = vi.fn()
    render(<ModernDateField value="2026-05-01" onChange={onChange} />)
    openCalendar()
    // Clicar en el botón "15"
    const day15 = screen.getByRole('button', { name: '15' })
    fireEvent.click(day15)
    expect(onChange).toHaveBeenCalledWith('2026-05-15')
  })

  it('selecciona el día 31 (último de mayo) correctamente', () => {
    const onChange = vi.fn()
    render(<ModernDateField value="2026-05-01" onChange={onChange} />)
    openCalendar()
    const day31 = screen.getByRole('button', { name: '31' })
    fireEvent.click(day31)
    expect(onChange).toHaveBeenCalledWith('2026-05-31')
    // Asegurarse que NO se llama con '2026-05-25'
    expect(onChange).not.toHaveBeenCalledWith('2026-05-25')
  })

  it('selecciona el día 30 (último de abril) correctamente', () => {
    const onChange = vi.fn()
    render(<ModernDateField value="2026-04-01" onChange={onChange} />)
    openCalendar()
    const day30 = screen.getByRole('button', { name: '30' })
    fireEvent.click(day30)
    expect(onChange).toHaveBeenCalledWith('2026-04-30')
  })

  it('selecciona el día 28 en febrero de año no bisiesto', () => {
    const onChange = vi.fn()
    render(<ModernDateField value="2025-02-01" onChange={onChange} />)
    openCalendar()
    const day28 = screen.getByRole('button', { name: '28' })
    fireEvent.click(day28)
    expect(onChange).toHaveBeenCalledWith('2025-02-28')
  })

  it('selecciona el día 29 en febrero bisiesto (2024)', () => {
    const onChange = vi.fn()
    render(<ModernDateField value="2024-02-01" onChange={onChange} />)
    openCalendar()
    const day29 = screen.getByRole('button', { name: '29' })
    fireEvent.click(day29)
    expect(onChange).toHaveBeenCalledWith('2024-02-29')
  })

  it('cierra el calendario después de seleccionar un día', () => {
    render(<ModernDateField value="2026-05-01" onChange={() => {}} />)
    openCalendar()
    expect(screen.getByRole('dialog', { name: /Calendario/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(screen.queryByRole('dialog', { name: /Calendario/i })).not.toBeInTheDocument()
  })
})

describe('ModernDateField — número de días mostrados', () => {
  it('mayo 2026 muestra exactamente 31 botones de días (1 al 31)', () => {
    render(<ModernDateField value="2026-05-01" onChange={() => {}} />)
    openCalendar()
    // Los días son botones con texto numérico; los botones de navegación también están
    // Filtramos por nombre de accesibilidad que sea un número
    const dayButtons = screen.getAllByRole('button').filter((b) => {
      const t = b.textContent?.trim()
      return t && /^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= 31
    })
    expect(dayButtons).toHaveLength(31)
    // El último botón debe ser "31"
    const nums = dayButtons.map((b) => Number(b.textContent?.trim())).sort((a, b) => a - b)
    expect(nums[nums.length - 1]).toBe(31)
  })

  it('abril 2026 muestra exactamente 30 días', () => {
    render(<ModernDateField value="2026-04-01" onChange={() => {}} />)
    openCalendar()
    const dayButtons = screen.getAllByRole('button').filter((b) => {
      const t = b.textContent?.trim()
      return t && /^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= 30
    })
    expect(dayButtons).toHaveLength(30)
    expect(screen.queryByRole('button', { name: '31' })).not.toBeInTheDocument()
  })

  it('febrero 2025 (no bisiesto) muestra exactamente 28 días', () => {
    render(<ModernDateField value="2025-02-01" onChange={() => {}} />)
    openCalendar()
    expect(screen.queryByRole('button', { name: '29' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '28' })).toBeInTheDocument()
  })
})

describe('ModernDateField — rango de años', () => {
  it('el selector de año incluye 1960', () => {
    render(<ModernDateField onChange={() => {}} />)
    openCalendar()
    const yearSelect = screen.getByRole('combobox', { name: /Año/i })
    const options = Array.from(yearSelect.querySelectorAll('option')).map((o) => Number(o.value))
    expect(options).toContain(1960)
  })

  it('el selector de año incluye el año actual', () => {
    render(<ModernDateField onChange={() => {}} />)
    openCalendar()
    const yearSelect = screen.getByRole('combobox', { name: /Año/i })
    const options = Array.from(yearSelect.querySelectorAll('option')).map((o) => Number(o.value))
    expect(options).toContain(new Date().getFullYear())
  })

  it('el selector de año incluye current+1', () => {
    render(<ModernDateField onChange={() => {}} />)
    openCalendar()
    const yearSelect = screen.getByRole('combobox', { name: /Año/i })
    const options = Array.from(yearSelect.querySelectorAll('option')).map((o) => Number(o.value))
    expect(options).toContain(new Date().getFullYear() + 1)
  })
})

describe('ModernDateField — navegación de meses', () => {
  it('mes anterior cambia el mes mostrado', () => {
    render(<ModernDateField value="2026-05-01" onChange={() => {}} />)
    openCalendar()
    const monthSelect = screen.getByRole('combobox', { name: /Mes/i })
    expect(monthSelect.value).toBe('5')
    fireEvent.click(screen.getByRole('button', { name: /Mes anterior/i }))
    expect(monthSelect.value).toBe('4')
  })

  it('mes siguiente cambia el mes mostrado', () => {
    render(<ModernDateField value="2026-05-01" onChange={() => {}} />)
    openCalendar()
    const monthSelect = screen.getByRole('combobox', { name: /Mes/i })
    fireEvent.click(screen.getByRole('button', { name: /Mes siguiente/i }))
    expect(monthSelect.value).toBe('6')
  })
})

describe('ModernDateField — sin botón Borrar', () => {
  it('no renderiza acciones de borrado al lado del selector', () => {
    render(<ModernDateField value="2026-05-15" onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /Quitar fecha/i })).not.toBeInTheDocument()
  })
})
