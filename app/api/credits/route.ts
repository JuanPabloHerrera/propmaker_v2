import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Current balance + subscription state + recent ledger (RLS scoped). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [creditsRes, txRes] = await Promise.all([
    supabase
      .from('user_credits')
      .select('balance, plan_id, subscription_status')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('credit_transactions')
      .select('id, type, amount, balance_after, reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({
    balance: creditsRes.data?.balance ?? 0,
    plan_id: creditsRes.data?.plan_id ?? null,
    subscription_status: creditsRes.data?.subscription_status ?? null,
    transactions: txRes.data ?? [],
  })
}
