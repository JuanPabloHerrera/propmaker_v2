'use client'

import { useState } from 'react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Password input with a show/hide eye toggle. Takes every normal input prop
 * (id, value, onChange, autoComplete, aria-*) and forwards it to the field.
 */
export function PasswordField({ className = 'field', style, ...props }: Props) {
  const [show, setShow] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={className}
        style={{ paddingRight: 34, ...style }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        tabIndex={-1}
        className="inline-flex items-center justify-center"
        style={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 26,
          height: 26,
          borderRadius: 6,
          color: 'var(--ink-3)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {show ? (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M16.7 16.7A9.9 9.9 0 0112 18c-5 0-9.3-3.1-11-6a17.8 17.8 0 013.9-4.7M6.6 6.6A9.9 9.9 0 0112 6c5 0 9.3 3.1 11 6a17.9 17.9 0 01-4 4.8" />
            <path d="M3 3l18 18" />
          </svg>
        ) : (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-6 11-6 11 6 11 6-4 6-11 6-11-6-11-6z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
