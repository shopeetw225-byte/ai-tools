import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('App smoke', () => {
  it('renders loading state or auth screen', () => {
    render(<App />)
    expect(screen.getByText(/loading|sign/i)).toBeTruthy()
  })
})
