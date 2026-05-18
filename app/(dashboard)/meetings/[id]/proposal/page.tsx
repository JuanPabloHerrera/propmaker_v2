'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PostMeetingChat } from '@/components/proposal/PostMeetingChat'
import { ProposalEditor } from '@/components/proposal/ProposalEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Meeting, Proposal } from '@/types'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [proposalMarkdown, setProposalMarkdown] = useState<string>('')
  const [isLocalhost, setIsLocalhost] = useState(false)
  const [hasTranscript, setHasTranscript] = useState(false)

  useEffect(() => {
    setIsLocalhost(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  }, [])

  const fetchData = useCallback(async () => {
    const [meetingRes, proposalRes, segCount] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', id).single(),
      fetch(`/api/meetings/${id}/proposal`).then((r) => r.json()),
      supabase.from('transcript_segments').select('id', { count: 'exact', head: true }).eq('meeting_id', id),
    ])
    if (meetingRes.data) setMeeting(meetingRes.data as Meeting)
    if (proposalRes) setProposal(proposalRes as Proposal)
    if ((segCount.count ?? 0) > 0) setHasTranscript(true)
  }, [id, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Localhost: silently poll sync until transcript arrives (recording may still be processing)
  useEffect(() => {
    if (!isLocalhost || hasTranscript) return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/meetings/${id}/sync`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.synced > 0) setHasTranscript(true)
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [isLocalhost, hasTranscript, id])

  function handleProposalGenerated(markdown: string) {
    setProposalMarkdown(markdown)
    toast.success('Proposal generated!')
  }

  async function toggleStatus() {
    if (!proposal) return
    const newStatus = proposal.status === 'draft' ? 'final' : 'draft'
    await fetch(`/api/meetings/${id}/proposal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setProposal({ ...proposal, status: newStatus })
    toast.success(`Proposal marked as ${newStatus}.`)
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#d2d2d7] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">←</Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#1d1d1f]">
                {meeting?.title ?? 'Meeting'}
              </h2>
              <span className="text-xs text-[#6e6e73]">›</span>
              <span className="text-sm text-[#6e6e73]">Proposal</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {proposal && (
            <>
              <Badge
                variant="outline"
                className={
                  proposal.status === 'final'
                    ? 'bg-green-50 text-green-700 border-green-200 text-xs'
                    : 'bg-[#f5f5f7] text-[#6e6e73] border-[#d2d2d7] text-xs'
                }
              >
                {proposal.status === 'final' ? 'Final' : 'Draft'}
              </Badge>
              <Button
                onClick={toggleStatus}
                variant="outline"
                size="sm"
                className="rounded-lg border-[#d2d2d7] text-[#1d1d1f] h-8 text-xs hover:bg-[#f5f5f7]"
              >
                {proposal.status === 'final' ? 'Back to draft' : 'Mark as final'}
              </Button>
            </>
          )}
          {isLocalhost && !hasTranscript && (
            <span className="text-xs text-[#6e6e73] animate-pulse">Transcript loading…</span>
          )}
          <Link href={`/meetings/${id}/live`} className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
            View transcript
          </Link>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel */}
        <div className="w-80 shrink-0 border-r border-[#d2d2d7] flex flex-col overflow-hidden">
          <div className="px-5 py-2.5 border-b border-[#d2d2d7]">
            <span className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">Post-meeting Q&A</span>
          </div>
          <PostMeetingChat meetingId={id} onProposalGenerated={handleProposalGenerated} />
        </div>

        {/* Proposal editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-2.5 border-b border-[#d2d2d7] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">Proposal</span>
            <span className="text-xs text-[#6e6e73]">Auto-saved</span>
          </div>
          <ProposalEditor
            meetingId={id}
            initialContent={proposalMarkdown || undefined}
            initialJson={!proposalMarkdown && proposal?.content_json ? proposal.content_json : undefined}
          />
        </div>
      </div>
    </div>
  )
}
