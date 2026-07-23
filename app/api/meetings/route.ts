import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { mode, meeting_url } = body as { mode?: string; meeting_url?: string | null }

  if (mode !== 'local' && mode !== 'online') {
    return NextResponse.json({ error: 'mode must be "local" or "online"' }, { status: 400 })
  }
  if (mode === 'online' && !meeting_url) {
    return NextResponse.json({ error: 'Meeting URL required for online meetings' }, { status: 400 })
  }

  // Placeholder title until post-meeting metadata extraction names the meeting
  // from the transcript (online meetings may get a Recall title sooner).
  const dateLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      title: `Meeting — ${dateLabel}`,
      meeting_type: 'consulting',
      meeting_url: mode === 'online' ? meeting_url : null,
      status: 'pending',
      capture_mode: mode === 'online' ? 'recall' : 'browser',
      attendees: [],
      deal_status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
