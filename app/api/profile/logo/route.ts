import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])

function extensionFor(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/svg+xml') return 'svg'
  return 'bin'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PNG, JPEG, WEBP, or SVG.' },
      { status: 415 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Logo must be 2 MB or smaller.' }, { status: 413 })
  }

  const ext = extensionFor(file.type)
  // Cache-bust by appending a timestamp; the path stays per-user and is
  // overwritten on every upload so the bucket doesn't accumulate junk.
  const objectPath = `${user.id}/logo-${Date.now()}.${ext}`

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('user-logos')
    .upload(objectPath, bytes, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Best-effort cleanup of older logos in the same folder.
  const { data: existing } = await supabase.storage
    .from('user-logos')
    .list(user.id, { limit: 50 })
  const stale = (existing ?? [])
    .map((o) => `${user.id}/${o.name}`)
    .filter((p) => p !== objectPath)
  if (stale.length > 0) {
    await supabase.storage.from('user-logos').remove(stale)
  }

  const { data: publicUrl } = supabase.storage
    .from('user-logos')
    .getPublicUrl(objectPath)

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ logo_url: publicUrl.publicUrl })
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ logo_url: publicUrl.publicUrl })
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabase.storage
    .from('user-logos')
    .list(user.id, { limit: 50 })
  if (existing && existing.length > 0) {
    await supabase.storage
      .from('user-logos')
      .remove(existing.map((o) => `${user.id}/${o.name}`))
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ logo_url: null })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logo_url: null })
}
