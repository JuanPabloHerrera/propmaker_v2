'use client'

import * as React from 'react'
import Link from 'next/link'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthError({ error, reset }: Props) {
  React.useEffect(() => {
    console.error('[auth] route error', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-[#d2d2d7] p-8 text-center"
        role="alert"
      >
        <h1 className="text-[16px] font-semibold text-[#1d1d1f] mb-2">
          Something went wrong
        </h1>
        <p className="text-[13px] text-[#6e6e73] mb-4 leading-relaxed">
          {error.message || 'We could not complete that step.'}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="h-9 px-4 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#2d2d2f]"
          >
            Try again
          </button>
          <Link
            href="/sign-in"
            className="h-9 px-4 inline-flex items-center rounded-xl bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium border border-[#d2d2d7]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
