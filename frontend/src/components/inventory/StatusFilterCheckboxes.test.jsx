import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StatusFilterCheckboxes from './StatusFilterCheckboxes'

describe('StatusFilterCheckboxes', () => {
  it('alterna estados y notifica', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<StatusFilterCheckboxes value={[]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /crítico/i }))
    expect(onChange).toHaveBeenCalledWith(['CRITICO'])
    rerender(<StatusFilterCheckboxes value={['CRITICO']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /óptimo/i }))
    expect(onChange).toHaveBeenCalledWith(['CRITICO', 'OPTIMO'])
  })
})
