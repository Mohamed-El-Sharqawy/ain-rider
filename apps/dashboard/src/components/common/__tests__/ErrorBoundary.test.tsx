import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

function Bomb({ on }: { on: boolean }) {
  if (on) throw new Error(' kaboom ')
  return <div>safe</div>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders children while no error occurs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb on={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('safe')).toBeInTheDocument()
  })

  it('shows the default fallback with the error message when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb on />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('resets the boundary and calls onReset', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReset = vi.fn()
    const { rerender } = render(
      <ErrorBoundary onReset={onReset}>
        <Bomb on />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // stop the child from throwing, then reset: the children render again
    rerender(
      <ErrorBoundary onReset={onReset}>
        <Bomb on={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Try Again'))
    expect(onReset).toHaveBeenCalledOnce()
    expect(screen.getByText('safe')).toBeInTheDocument()
  })

  it('renders the custom fallback instead of the default', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<div>custom-oops</div>}>
        <Bomb on />
      </ErrorBoundary>,
    )
    expect(screen.getByText('custom-oops')).toBeInTheDocument()
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument()
  })

  it('shows the generic message when the thrown error has no message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function EmptyBomb(): never {
      throw new Error('')
    }
    render(
      <ErrorBoundary>
        <EmptyBomb />
      </ErrorBoundary>,
    )
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })
})
