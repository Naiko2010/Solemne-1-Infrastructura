import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryTypeahead from './CategoryTypeahead'

const resolveCategoryNameForLocal = vi.fn()

vi.mock('../../lib/apiClient', () => ({
  getAuthContext: vi.fn(() => Promise.resolve({ token: 't' })),
}))

vi.mock('../../lib/inventoryApi', () => ({
  resolveCategoryNameForLocal: (...args) => resolveCategoryNameForLocal(...args),
}))

describe('CategoryTypeahead (HU-87)', () => {
  const localId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  beforeEach(() => {
    resolveCategoryNameForLocal.mockReset()
    resolveCategoryNameForLocal.mockResolvedValue('Bebidas')
  })

  it('al pulsar Enter guarda la categoría vía API y actualiza el valor', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CategoryTypeahead localId={localId} value="bebidas" onChange={onChange} disabled={false} />,
    )

    const input = screen.getByPlaceholderText(/Enter para guardarla/i)
    input.focus()
    await user.keyboard('{Enter}')

    expect(resolveCategoryNameForLocal).toHaveBeenCalledWith(localId, 'bebidas')
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('Bebidas')
    })
  })

  it('no muestra listado de sugerencias al enfocar', async () => {
    const user = userEvent.setup()
    render(<CategoryTypeahead localId={localId} value="" onChange={() => {}} disabled={false} />)

    await user.click(screen.getByPlaceholderText(/Enter para guardarla/i))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
})
