'use client'

import * as React from 'react'
import { Icon } from '@/components/ui/icon'
import type { BriefActionItem, BriefPriorityLevel, ProposalBrief } from '@/types'

interface Props {
  value: ProposalBrief
  onChange: (next: ProposalBrief) => void
  disabled?: boolean
}

const PRIORITY_ORDER: Record<BriefPriorityLevel, number> = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABEL: Record<BriefPriorityLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/**
 * The editable pre-proposal brief. Everything the consultant reviews and tweaks
 * before the proposal is generated: the overview, the prioritized action items
 * (the backbone of the proposal), scope, recommended catalog items, and open
 * questions. Fully controlled — the /brief page owns state, autosave, and the
 * "Generate proposal" hand-off.
 */
export function BriefReview({ value, onChange, disabled }: Props) {
  const patch = (p: Partial<ProposalBrief>) => onChange({ ...value, ...p })

  return (
    <div className="flex flex-col" style={{ gap: 22 }}>
      <Field label="Overview" hint="The one-paragraph read on this engagement.">
        <TextArea
          value={value.overview}
          onChange={(v) => patch({ overview: v })}
          placeholder="A short synthesis of what this client needs and why…"
          disabled={disabled}
          rows={3}
        />
      </Field>

      <Field
        label="Priorities & action items"
        hint="The backbone of the proposal — ordered most to least important."
        count={value.priorities.length}
      >
        <PriorityList
          items={value.priorities}
          onChange={(priorities) => patch({ priorities })}
          disabled={disabled}
        />
      </Field>

      <Field label="Client goals" hint="What they said they want to achieve.">
        <EditableList
          items={value.clientGoals}
          onChange={(clientGoals) => patch({ clientGoals })}
          placeholder="Add a goal the client stated…"
          disabled={disabled}
        />
      </Field>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Field label="In scope">
          <EditableList
            items={value.scope}
            onChange={(scope) => patch({ scope })}
            placeholder="Add an in-scope item…"
            disabled={disabled}
          />
        </Field>
        <Field label="Out of scope">
          <EditableList
            items={value.outOfScope}
            onChange={(outOfScope) => patch({ outOfScope })}
            placeholder="Add something explicitly excluded…"
            disabled={disabled}
          />
        </Field>
      </div>

      <Field label="Recommended catalog items" hint="Only names from your catalog are used as line items.">
        <EditableList
          items={value.recommendedProducts}
          onChange={(recommendedProducts) => patch({ recommendedProducts })}
          placeholder="Add a catalog product name…"
          disabled={disabled}
        />
      </Field>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Field label="Budget signals">
          <TextArea
            value={value.budgetNotes ?? ''}
            onChange={(v) => patch({ budgetNotes: v.trim() ? v : null })}
            placeholder="Budget range, constraints, or approvals mentioned…"
            disabled={disabled}
            rows={2}
          />
        </Field>
        <Field label="Timeline signals">
          <TextArea
            value={value.timelineNotes ?? ''}
            onChange={(v) => patch({ timelineNotes: v.trim() ? v : null })}
            placeholder="Deadlines, phases, or urgency mentioned…"
            disabled={disabled}
            rows={2}
          />
        </Field>
      </div>

      <Field
        label="Open questions"
        hint="Unresolved items to flag — these do not go into the proposal."
        count={value.openQuestions.length}
      >
        <EditableList
          items={value.openQuestions}
          onChange={(openQuestions) => patch({ openQuestions })}
          placeholder="Add something still unclear…"
          disabled={disabled}
        />
      </Field>
    </div>
  )
}

// ── Layout primitives ───────────────────────────────────────────────

function Field({
  label,
  hint,
  count,
  children,
}: {
  label: string
  hint?: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="pm-eyebrow"
          style={{ color: 'var(--ink-2)' }}
        >
          {label}
        </span>
        {typeof count === 'number' && count > 0 && (
          <span className="mono-num" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
            {count}
          </span>
        )}
      </div>
      {hint && (
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '-2px 0 8px', lineHeight: 1.45 }}>
          {hint}
        </p>
      )}
      {children}
    </section>
  )
}

const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,253,247,0.6)',
  border: '0.5px solid var(--line-1)',
  borderRadius: 9,
  padding: '8px 10px',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--ink-1)',
  outline: 'none',
  resize: 'none' as const,
}

function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      style={inputBase}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-base)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-1)')}
    />
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  onEnter,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  onEnter?: () => void
  autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault()
          onEnter()
        }
      }}
      style={{ ...inputBase, padding: '7px 10px' }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-base)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-1)')}
    />
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid place-items-center rounded-md hover:bg-[rgba(28,24,20,0.05)] disabled:opacity-30"
      style={{ width: 26, height: 26, color: 'var(--ink-3)', flexShrink: 0 }}
    >
      {children}
    </button>
  )
}

// ── Editable string list ────────────────────────────────────────────

function EditableList({
  items,
  onChange,
  placeholder,
  disabled,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [draft, setDraft] = React.useState('')

  const add = () => {
    const v = draft.trim()
    if (!v) return
    onChange([...items, v])
    setDraft('')
  }
  const update = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)))
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span style={{ color: 'var(--accent-base)', flexShrink: 0 }}>
            <Icon name="check" size={12} strokeWidth={1.8} />
          </span>
          <TextInput value={item} onChange={(v) => update(i, v)} disabled={disabled} />
          <IconButton label="Remove item" onClick={() => remove(i)} disabled={disabled}>
            <Icon name="close" size={11} strokeWidth={1.6} />
          </IconButton>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span style={{ width: 12, flexShrink: 0 }} />
        <TextInput
          value={draft}
          onChange={setDraft}
          onEnter={add}
          placeholder={placeholder ?? 'Add an item…'}
          disabled={disabled}
        />
        <IconButton label="Add item" onClick={add} disabled={disabled || !draft.trim()}>
          <Icon name="plus" size={13} strokeWidth={1.8} />
        </IconButton>
      </div>
    </div>
  )
}

// ── Prioritized action items ────────────────────────────────────────

function PriorityList({
  items,
  onChange,
  disabled,
}: {
  items: BriefActionItem[]
  onChange: (next: BriefActionItem[]) => void
  disabled?: boolean
}) {
  const update = (i: number, patch: Partial<BriefActionItem>) =>
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const add = () =>
    onChange([...items, { title: '', detail: '', priority: 'medium' }])
  const sortByPriority = () =>
    onChange([...items].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]))

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {items.map((item, i) => (
        <div
          key={i}
          className="card"
          style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}
        >
          <div
            className="flex flex-col items-center"
            style={{ gap: 2, paddingTop: 2, flexShrink: 0 }}
          >
            <IconButton label="Move up" onClick={() => move(i, -1)} disabled={disabled || i === 0}>
              <Icon name="chevD" size={13} strokeWidth={1.8} style={{ transform: 'rotate(180deg)' }} />
            </IconButton>
            <span
              className="mono-num"
              style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}
            >
              {i + 1}
            </span>
            <IconButton
              label="Move down"
              onClick={() => move(i, 1)}
              disabled={disabled || i === items.length - 1}
            >
              <Icon name="chevD" size={13} strokeWidth={1.8} />
            </IconButton>
          </div>

          <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 6 }}>
            <TextInput
              value={item.title}
              onChange={(v) => update(i, { title: v })}
              placeholder="Deliverable or workstream…"
              disabled={disabled}
            />
            <TextArea
              value={item.detail}
              onChange={(v) => update(i, { detail: v })}
              placeholder="One or two sentences on what this involves…"
              disabled={disabled}
              rows={2}
            />
            <PrioritySelect
              value={item.priority}
              onChange={(priority) => update(i, { priority })}
              disabled={disabled}
            />
          </div>

          <IconButton label="Remove item" onClick={() => remove(i)} disabled={disabled}>
            <Icon name="close" size={12} strokeWidth={1.6} />
          </IconButton>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="flex items-center gap-1.5 font-medium disabled:opacity-50"
          style={{
            height: 28,
            padding: '0 11px',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--ink-2)',
            background: 'rgba(255,253,247,0.6)',
            border: '0.5px solid var(--line-1)',
          }}
        >
          <Icon name="plus" size={13} strokeWidth={1.8} />
          Add priority
        </button>
        {items.length > 1 && (
          <button
            type="button"
            onClick={sortByPriority}
            disabled={disabled}
            className="font-medium disabled:opacity-50"
            style={{ fontSize: 11.5, color: 'var(--ink-3)', background: 'transparent' }}
          >
            Sort by priority
          </button>
        )}
      </div>
    </div>
  )
}

function PrioritySelect({
  value,
  onChange,
  disabled,
}: {
  value: BriefPriorityLevel
  onChange: (v: BriefPriorityLevel) => void
  disabled?: boolean
}) {
  const levels: BriefPriorityLevel[] = ['high', 'medium', 'low']
  return (
    <div className="flex items-center gap-1">
      {levels.map((lvl) => {
        const active = value === lvl
        return (
          <button
            key={lvl}
            type="button"
            onClick={() => onChange(lvl)}
            disabled={disabled}
            className="font-medium disabled:opacity-50"
            style={{
              height: 22,
              padding: '0 9px',
              borderRadius: 6,
              fontSize: 11,
              cursor: disabled ? 'default' : 'pointer',
              color: active ? 'white' : 'var(--ink-3)',
              background: active
                ? 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)'
                : 'transparent',
              border: active
                ? '0.5px solid rgba(77,138,107,0.6)'
                : '0.5px solid var(--line-1)',
            }}
          >
            {PRIORITY_LABEL[lvl]}
          </button>
        )
      })}
    </div>
  )
}
