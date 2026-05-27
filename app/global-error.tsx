'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Last-resort boundary that replaces the root layout, so it can't rely on
// the app's Tailwind theme — styles are inlined. Brand accent = Legacy
// Scale red.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0b',
          padding: '1rem',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <div
            style={{
              marginBottom: '1.5rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#d11a1a',
            }}
          >
            Legacy Scale
          </div>
          <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem', fontWeight: 700 }}>
            Critical Error
          </h1>
          <p style={{ marginBottom: '2rem', color: '#a1a1aa' }}>
            A critical error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: '#d11a1a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
