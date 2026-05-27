import * as React from 'react'

interface Props {
  id: string
  message: string | null
}

/**
 * Accessible inline error for form fields. Pair with the input's
 * `aria-describedby={id}` and `aria-invalid={Boolean(message)}`.
 * Renders nothing when there's no message so layout stays stable.
 */
export function FieldError({ id, message }: Props) {
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className="mt-1.5"
      style={{
        fontSize: 11,
        color: 'var(--rec)',
        minHeight: message ? undefined : 0,
        // visibility: hidden when empty so screen readers still announce
        // updates without consuming layout space.
        visibility: message ? 'visible' : 'hidden',
        height: message ? undefined : 0,
      }}
    >
      {message ?? ''}
    </p>
  )
}
