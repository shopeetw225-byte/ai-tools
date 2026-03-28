import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('App smoke', () => {
  it('renders loading state or auth screen', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    expect(screen.getAllByText(/loading|sign|AI/i).length).toBeGreaterThan(0)
  })
})
