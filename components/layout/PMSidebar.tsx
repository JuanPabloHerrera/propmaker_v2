'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/components/ui/icon'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { SidebarSignOut } from '@/components/dashboard/SidebarSignOut'
import type { SidebarCounts } from '@/lib/sidebar'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  href: string
  icon: IconName
  badge?: string | number
  accent?: boolean
  matcher?: (pathname: string) => boolean
}

interface PMSidebarProps {
  user: { name: string; email: string; initials: string }
  counts: SidebarCounts
}

export function PMSidebar({ user, counts }: PMSidebarProps) {
  const pathname = usePathname()

  const workspace: NavItem[] = [
    {
      id: 'home',
      label: 'Home',
      href: '/',
      icon: 'home',
      matcher: (p) => p === '/',
    },
    {
      id: 'new',
      label: 'New Meeting',
      href: '/meetings/new',
      icon: 'plus',
      accent: true,
    },
    {
      id: 'upload',
      label: 'Upload Meeting',
      href: '/meetings/upload',
      icon: 'upload',
    },
  ]

  const library: NavItem[] = [
    { id: 'profile', label: 'Profile', href: '/profile', icon: 'user' },
    {
      id: 'resources',
      label: 'Resources',
      href: '/resources',
      icon: 'box',
      // One badge for both halves of the page: services + reference files.
      badge: counts.products + counts.references || undefined,
      matcher: (p) => p.startsWith('/resources'),
    },
    {
      id: 'proposals',
      label: 'Proposals',
      href: '/?filter=proposals',
      icon: 'doc',
      badge: counts.proposals || undefined,
    },
    {
      id: 'meetings',
      label: 'Meetings',
      href: '/?filter=meetings',
      icon: 'cal',
      badge: counts.meetings || undefined,
      matcher: (p) => p.startsWith('/meetings/'),
    },
    {
      id: 'billing',
      label: 'Billing',
      href: '/billing',
      icon: 'sparkle',
      matcher: (p) => p.startsWith('/billing'),
    },
  ]

  const lowCredits = counts.credits < 97

  const isActive = (item: NavItem) => {
    if (item.matcher) return item.matcher(pathname)
    return pathname === item.href
  }

  return (
    <aside
      aria-label="Primary navigation"
      className="flex flex-col shrink-0"
      style={{
        width: 240,
        padding: '18px 12px 14px',
        gap: 2,
        borderRight: '0.5px solid var(--line-1)',
        background: 'rgba(255, 252, 245, 0.35)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-4">
        <div
          aria-hidden="true"
          className="grid place-items-center text-white font-semibold text-xs"
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: 'linear-gradient(135deg, var(--accent-base) 0%, var(--accent-2) 100%)',
            boxShadow: '0 2px 6px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          P
        </div>
        <div className="text-[13.5px] font-semibold tracking-tight" style={{ color: 'var(--ink-1)' }}>
          PropMaker
        </div>
      </div>

      <nav aria-label="Workspace">
        <SidebarLabel>Workspace</SidebarLabel>
        <ul className="contents" role="list">
          {workspace.map((it) => (
            <SidebarItem key={it.id} item={it} active={isActive(it)} />
          ))}
        </ul>
      </nav>

      <div
        aria-hidden="true"
        className="h-px my-2.5 mx-2"
        style={{ background: 'var(--line-1)' }}
      />

      <nav aria-label="Library">
        <SidebarLabel>Library</SidebarLabel>
        <ul className="contents" role="list">
          {library.map((it) => (
            <SidebarItem key={it.id} item={it} active={isActive(it)} />
          ))}
        </ul>
      </nav>

      {/* Credits — same shape as a nav item; the wrapper's mt-auto pins it above
          the user card, and paddingTop guarantees a gap under "Billing" even
          when the nav fills the sidebar. */}
      <div className="mt-auto" style={{ paddingTop: 16 }}>
        <Link
          href="/billing"
          className="flex items-center gap-[9px] rounded-[7px] text-[12.5px] transition-colors hover:bg-[rgba(28,24,20,0.04)]"
          style={{ padding: '6px 10px', color: 'var(--ink-2)' }}
        >
          <span
            className="shrink-0"
            style={{ color: lowCredits ? '#b45309' : 'var(--accent-base)' }}
          >
            <Icon name="sparkle" />
          </span>
          <span className="flex-1">Credits</span>
          <span
            className="mono-num"
            style={{ fontSize: 10.5, color: lowCredits ? '#b45309' : 'var(--ink-3)' }}
          >
            {formatNumber(counts.credits)}
          </span>
        </Link>
      </div>

      {/* User card */}
      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] hover:bg-[rgba(28,24,20,0.04)] transition-colors">
        <AvatarInitials initials={user.initials} color="sage" size={26} />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="text-[12.5px] font-medium" style={{ color: 'var(--ink-1)' }}>
            {user.name}
          </div>
          <div
            className="text-[11px] whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ color: 'var(--ink-3)' }}
          >
            {user.email}
          </div>
        </div>
      </div>
      <div className="px-1 mt-1">
        <Link
          href="/support"
          // Remember where they came from so a bug report carries the page.
          // document.referrer can't do this — client-side navigation never
          // updates it.
          onClick={() => {
            if (pathname !== '/support') sessionStorage.setItem('pm:last-page', pathname)
          }}
          className={cn(
            'w-full flex items-center gap-[9px] rounded-[7px] transition-colors hover:bg-[rgba(28,24,20,0.04)]',
            pathname === '/support' && 'bg-[rgba(28,24,20,0.05)]',
          )}
          style={{ padding: '6px 10px', fontSize: 12.5, color: 'var(--ink-2)' }}
        >
          <span style={{ color: 'var(--ink-3)' }}>
            <Icon name="help" />
          </span>
          Support
        </Link>
        <SidebarSignOut />
      </div>
    </aside>
  )
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10.5px] font-medium uppercase tracking-wider"
      style={{ padding: '14px 12px 6px', color: 'var(--ink-3)', letterSpacing: '0.04em' }}
    >
      {children}
    </div>
  )
}

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-[9px] rounded-[7px] text-[12.5px] transition-colors',
        active
          ? 'bg-white/55 shadow-[0_1px_2px_rgba(28,22,14,0.06),inset_0_0_0_0.5px_rgba(255,255,255,0.6)] font-medium'
          : 'hover:bg-[rgba(28,24,20,0.04)]',
      )}
      style={{
        padding: '6px 10px',
        color: active ? 'var(--ink-1)' : 'var(--ink-2)',
      }}
    >
      <span
        className="shrink-0"
        style={{
          color: item.accent || active ? 'var(--accent-base)' : 'var(--ink-3)',
        }}
      >
        <Icon name={item.icon} />
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge != null && (
        <span
          className="mono-num"
          style={{ fontSize: 10.5, color: 'var(--ink-3)' }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  )
}
