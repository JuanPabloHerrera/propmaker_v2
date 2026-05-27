import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    name,
    category,
    description = null,
    price_amount = null,
    price_unit = null,
    currency = 'MXN',
    notes = null,
    active = true,
  } = body

  if (!name || !category) {
    return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      name,
      category,
      description,
      price_amount,
      price_unit,
      currency,
      notes,
      active,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
