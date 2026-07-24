import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupportForm } from '@/components/support/SupportForm'

export default async function SupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  return (
    <div className="pm-page lg-shell" style={{ padding: '28px 36px 40px' }}>
      <div className="pm-eyebrow">Support</div>
      <h1 className="pm-h1" style={{ marginBottom: 6 }}>
        Get in touch
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 22 }}>
        Tell us what&apos;s going on and we&apos;ll reply by email. Bug reports are most useful
        with the steps that led to it.
      </p>

      <div className="flex flex-col gap-5" style={{ maxWidth: 720 }}>
        <SupportForm userEmail={user.email ?? ''} />
      </div>
    </div>
  )
}
