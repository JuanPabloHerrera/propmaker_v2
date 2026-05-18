'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { MeetingType } from '@/types'
import { MEETING_TYPE_LABELS } from '@/types'
import Link from 'next/link'

type JoinMode = 'now' | 'schedule'

export default function NewMeetingPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [meetingType, setMeetingType] = useState<MeetingType>('consulting')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [joinMode, setJoinMode] = useState<JoinMode>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const body: Record<string, unknown> = {
      title,
      meeting_type: meetingType,
      meeting_url: meetingUrl,
    }
    if (joinMode === 'schedule' && scheduledAt) {
      body.scheduled_at = new Date(scheduledAt).toISOString()
    }

    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to create meeting')
      return
    }

    if (joinMode === 'now') {
      const botRes = await fetch(`/api/meetings/${data.id}/bot`, { method: 'POST' })
      const botData = await botRes.json()
      if (!botRes.ok) {
        toast.error(`Bot failed to join: ${botData.error ?? 'Unknown error'}`)
      } else {
        toast.success('Bot is joining the meeting…')
      }
      router.push(`/meetings/${data.id}/live`)
    } else {
      toast.success('Meeting scheduled.')
      router.push('/')
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
          ← Back
        </Link>
        <h2 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mt-3">New meeting</h2>
        <p className="text-sm text-[#6e6e73] mt-0.5">Set up a meeting and PropCopilot will join to transcribe and assist.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-[#d2d2d7] rounded-2xl p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-medium text-[#1d1d1f]">Meeting title</Label>
            <Input
              id="title"
              placeholder="e.g. Discovery call with Acme Corp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#1d1d1f]">Meeting type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMeetingType(type)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                    meetingType === type
                      ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                      : 'border-[#d2d2d7] text-[#1d1d1f] hover:border-[#6e6e73]'
                  }`}
                >
                  {MEETING_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url" className="text-sm font-medium text-[#1d1d1f]">Meeting URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://meet.google.com/abc-defg-hij"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              required
              className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white"
            />
            <p className="text-xs text-[#6e6e73]">Zoom, Google Meet, or Microsoft Teams link</p>
          </div>
        </div>

        {/* Join mode */}
        <div className="bg-white border border-[#d2d2d7] rounded-2xl p-6 space-y-4">
          <Label className="text-sm font-medium text-[#1d1d1f]">When should the bot join?</Label>
          <div className="flex gap-2">
            {(['now', 'schedule'] as JoinMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setJoinMode(mode)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  joinMode === mode
                    ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                    : 'border-[#d2d2d7] text-[#1d1d1f] hover:border-[#6e6e73]'
                }`}
              >
                {mode === 'now' ? 'Join now' : 'Schedule'}
              </button>
            ))}
          </div>

          {joinMode === 'schedule' && (
            <div className="space-y-1.5">
              <Label htmlFor="scheduled" className="text-sm font-medium text-[#1d1d1f]">Scheduled time</Label>
              <Input
                id="scheduled"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required={joinMode === 'schedule'}
                className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white"
              />
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white font-medium text-sm"
        >
          {loading ? 'Setting up…' : joinMode === 'now' ? 'Join meeting now' : 'Schedule meeting'}
        </Button>
      </form>
    </div>
  )
}
