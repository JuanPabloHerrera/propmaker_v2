'use client'

import type { Suggestion } from '@/types'

export function SuggestionsPanel({ suggestion }: { suggestion: Suggestion | null }) {
  const questions = suggestion?.questions ?? []

  return (
    <div className="w-64 shrink-0 border-l border-[#d2d2d7] flex flex-col">
      <div className="px-4 py-3 border-b border-[#d2d2d7]">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">💡</span>
          <span className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wide">Suggestions</span>
        </div>
        <p className="text-xs text-[#6e6e73] mt-0.5">Ask these next</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {questions.length === 0 ? (
          <p className="text-xs text-[#6e6e73] leading-relaxed">
            Suggestions will appear here as the conversation develops.
          </p>
        ) : (
          <ul className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="group">
                <div className="flex gap-2.5">
                  <span className="text-xs text-[#6e6e73] font-medium mt-0.5 shrink-0">
                    {i + 1}.
                  </span>
                  <p className="text-xs text-[#1d1d1f] leading-relaxed">{q}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {suggestion && (
        <div className="px-4 py-2 border-t border-[#d2d2d7]">
          <p className="text-xs text-[#6e6e73]">Updated as you talk</p>
        </div>
      )}
    </div>
  )
}
