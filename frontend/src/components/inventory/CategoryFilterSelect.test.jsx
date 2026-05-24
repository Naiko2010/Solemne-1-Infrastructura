import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryFilterSelect from './CategoryFilterSelect'

/** Radix Select en jsdom requiere Pointer Capture API. */
beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
})

describe('CategoryFilterSelect', () => {
  const options = [
    { id: 'aaa', name: 'Bebidas' },
    { id: 'bbb', name: 'Granos' },
  ]

  it('lista todas + opciones por id/nombre', async () => {
    const user = userEvent.setup()
    render(<CategoryFilterSelect value="" onChange={() => {}} options={options} />)
    expect(screen.getByRole('combobox', { name: /filtrar por categoría/i })).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: /filtrar por categoría/i }))
    expect(await screen.findByRole('option', { name: 'Todas las categorías' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bebidas' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Granos' })).toBeInTheDocument()
  })

  it('notifica onChange con el id de categoría', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CategoryFilterSelect value="" onChange={onChange} options={options} />)
    await user.click(screen.getByRole('combobox', { name: /filtrar por categoría/i }))
    await user.click(await screen.findByRole('option', { name: 'Granos' }))
    expect(onChange).toHaveBeenCalledWith('bbb')
  })

  it('respeta value controlado', () => {
    render(<CategoryFilterSelect value="aaa" onChange={() => {}} options={options} />)
    expect(screen.getByRole('combobox', { name: /filtrar por categoría/i })).toHaveTextContent('Bebidas')
  })
})
