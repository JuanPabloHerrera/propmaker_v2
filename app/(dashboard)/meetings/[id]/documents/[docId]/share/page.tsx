'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ExportActions } from '@/components/share/ExportActions'
import { Icon } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { DOC_TYPE_LABELS, type Meeting, type MeetingDocument } from '@/types'

export default function ExportPage() {
  const { id, docId } = useParams<{ id: string; docId: string }>()
  const supabase = createClient()

  const [meeting, setMeeting] = React.useState<Meeting | null>(null)
  const [doc, setDoc] = React.useState<MeetingDocument | null>(null)

  React.useEffect(() => {
    ;(async () => {
      const [meetingRes, docRes] = await Promise.all([
        supabase.from('meetings').select('*').eq('id', id).single(),
        supabase.from('meeting_documents').select('*').eq('id', docId).maybeSingle(),
      ])
      if (meetingRes.data) setMeeting(meetingRes.data as Meeting)
      if (docRes.data) setDoc(docRes.data as MeetingDocument)
    })()
  }, [id, docId, supabase])

  if (!meeting || !doc) {
    return (
      <div className="pm-page lg-shell" style={{ padding: '28px 36px 32px' }}>
        <Skeleton style={{ height: 28, width: 280, marginBottom: 22 }} />
        <Skeleton style={{ height: 320, width: 420, borderRadius: 14 }} />
      </div>
    )
  }

  const docTitle = doc.title || meeting.client_company || meeting.title

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <Link
        href={`/meetings/${id}/documents/${docId}`}
        className="inline-flex items-center gap-1 mb-3"
        style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
      >
        <Icon name="chevL" size={12} />
        Back to document
      </Link>

      <div className="pm-eyebrow">Export</div>
      <h1 className="pm-h1" style={{ marginBottom: 6 }}>
        Export {DOC_TYPE_LABELS[doc.doc_type].toLowerCase()}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 22 }}>
        {docTitle} — built by the AI agent with your brand.
      </p>

      <div style={{ maxWidth: 440 }}>
        <ExportActions documentId={doc.id} />
      </div>
    </div>
  )
}
