import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('meeting_id', id)
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json(null)
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { content_json, status } = body
  const updatePayload: Record<string, unknown> = {}
  if (content_json !== undefined) updatePayload.content_json = content_json
  if (status !== undefined) updatePayload.status = status

  // Upsert: one proposal per meeting
  const { data: existing } = await supabase
    .from('proposals')
    .select('id')
    .eq('meeting_id', id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('proposals')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({ meeting_id: id, user_id: user.id, ...updatePayload })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
