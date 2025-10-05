import { useState, useEffect, FormEvent } from 'react'
import './PasswordGate.css'

interface PasswordGateProps {
  children: React.ReactNode
}

function PasswordGate({ children }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const STORAGE_KEY = 'looped_auth'
  const PASSWORD_HASH = import.meta.env.VITE_PASSWORD_HASH

  // Check if already authenticated on mount
  useEffect(() => {
    const storedAuth = sessionStorage.getItem(STORAGE_KEY)
    if (storedAuth === PASSWORD_HASH) {
      setIsAuthenticated(true)
    }
  }, [PASSWORD_HASH])

  // SHA256 hash function using Web Crypto API
  const hashPassword = async (plainText: string): Promise<string> => {
    const encoder = new TextEncoder()
    const data = encoder.encode(plainText)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const hashedPassword = await hashPassword(password)

      if (hashedPassword === PASSWORD_HASH) {
        sessionStorage.setItem(STORAGE_KEY, hashedPassword)
        setIsAuthenticated(true)
      } else {
        setError('Invalid password')
        setPassword('')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error('Password hashing error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div className="password-gate">
      <div className="password-gate-container">
        <div className="password-gate-card">
          <h1 className="password-gate-title">
            <span className="password-gate-logo">Looped</span>
          </h1>
          <p className="password-gate-subtitle">Enter password to continue</p>

          <form onSubmit={handleSubmit} className="password-gate-form">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="password-gate-input"
              autoFocus
              disabled={isLoading}
            />

            {error && <p className="password-gate-error">{error}</p>}

            <button
              type="submit"
              className="password-gate-submit"
              disabled={isLoading || !password}
            >
              {isLoading ? 'Verifying...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default PasswordGate
