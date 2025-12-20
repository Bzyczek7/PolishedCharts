import { render, screen } from '@testing-library/react'
import App from '../App'
import { expect, test } from 'vitest'

test('renders tradingalert heading', () => {
  render(<App />)
  // Assuming we change App.tsx to include the title
  expect(screen.getByText(/TradingAlert/i)).toBeDefined()
})
