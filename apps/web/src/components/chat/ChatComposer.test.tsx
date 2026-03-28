import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposer } from './ChatComposer'

describe('ChatComposer', () => {
  it('submits on Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ChatComposer onSubmit={onSubmit} disabled={false} />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    await user.type(textarea, 'Hello{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('Hello')
  })

  it('inserts newline on Shift+Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ChatComposer onSubmit={onSubmit} disabled={false} />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    await user.type(textarea, 'Line1{Shift>}{Enter}{/Shift}Line2')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Line1\nLine2')
  })

  it('disables input and send button while disabled', () => {
    render(<ChatComposer onSubmit={() => {}} disabled={true} />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    const button = screen.getByRole('button', { name: /send/i })

    expect(textarea).toBeDisabled()
    expect(button).toBeDisabled()
  })

  it('clears input after submission', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ChatComposer onSubmit={onSubmit} disabled={false} />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    await user.type(textarea, 'Hello{Enter}')

    expect(textarea).toHaveValue('')
  })

  it('does not submit empty message', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ChatComposer onSubmit={onSubmit} disabled={false} />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    await user.type(textarea, '{Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('fills input when initialValue is provided', () => {
    render(<ChatComposer onSubmit={() => {}} disabled={false} initialValue="Hello" />)
    const textarea = screen.getByPlaceholderText(/ask anything/i)
    expect(textarea).toHaveValue('Hello')
  })
})
