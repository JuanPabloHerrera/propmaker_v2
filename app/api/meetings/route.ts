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
  const {
    title,
    meeting_type,
    meeting_url,
    scheduled_at,
    capture_mode = 'browser',
    selected_categories = [],
    attendees = [],
    context_summary = null,
    client_company = null,
    attached_product_ids = [],
  } = body

  if (!title || !meeting_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if ((capture_mode === 'recall' || capture_mode === 'both') && !meeting_url) {
    return NextResponse.json({ error: 'Meeting URL required when using Recall.ai bot' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      title,
      meeting_type,
      meeting_url: meeting_url ?? null,
      scheduled_at: scheduled_at ?? null,
      status: 'pending',
      capture_mode,
      selected_categories,
      attendees,
      context_summary,
      client_company,
      attached_product_ids,
      deal_status: scheduled_at ? 'upcoming' : 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
