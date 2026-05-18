import { createClient } from '@/lib/supabase/server'
import { createBot, stopBot } from '@/lib/recall'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (meetingError || !meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!meeting.meeting_url) return NextResponse.json({ error: 'No meeting URL set' }, { status: 400 })

  try {
    const bot = await createBot(meeting.meeting_url, id)

    await supabase
      .from('meetings')
      .update({ recall_bot_id: bot.id, status: 'active' })
      .eq('id', id)

    return NextResponse.json({ bot_id: bot.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[bot/POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meeting } = await supabase
    .from('meetings')
    .select('recall_bot_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (meeting?.recall_bot_id) {
    await stopBot(meeting.recall_bot_id)
  }

  await supabase
    .from('meetings')
    .update({ status: 'completed' })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
