import * as React from 'react'
import { cn } from '@/lib/utils'

// 1px-stroke 14x14 SVGs matching the PropMaker design. Don't replace with
// lucide-react — the stroke weight and viewBox are bespoke.

const PATHS: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M2 6l5-4 5 4v6H2z" />
      <path d="M5.5 12V8.5h3V12" />
    </>
  ),
  user: (
    <>
      <circle cx="7" cy="4.5" r="2.2" />
      <path d="M2.5 12.5c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5" />
    </>
  ),
  box: (
    <>
      <path d="M2 4l5-2 5 2v6l-5 2-5-2z" />
      <path d="M2 4l5 2 5-2M7 6v6" />
    </>
  ),
  list: <path d="M3 4h8M3 7h8M3 10h5" />,
  mic: (
    <>
      <rect x="5" y="2" width="4" height="7" rx="2" />
      <path d="M3 7.5a4 4 0 008 0M7 11.5V13" />
    </>
  ),
  doc: (
    <>
      <path d="M3 1.5h5l3 3V12a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5V2a.5.5 0 01.5-.5z" />
      <path d="M8 1.5V4.5h3M4.5 7.5h5M4.5 9.5h5M4.5 5.5h2" />
    </>
  ),
  sparkle: (
    <path d="M7 1.5l1.2 3.3L11.5 6 8.2 7.2 7 10.5 5.8 7.2 2.5 6l3.3-1.2zM11 10l.5 1.5L13 12l-1.5.5L11 14l-.5-1.5L9 12l1.5-.5z" />
  ),
  send: (
    <>
      <path d="M2 7l10-5-3 11-2.5-4.5z" />
      <path d="M6.5 8.5L9 6" />
    </>
  ),
  plus: <path d="M7 3v8M3 7h8" />,
  search: (
    <>
      <circle cx="6" cy="6" r="3.5" />
      <path d="M9 9l2.5 2.5" />
    </>
  ),
  cal: (
    <>
      <rect x="2" y="3" width="10" height="9" rx="1.5" />
      <path d="M2 6h10M5 2v2M9 2v2" />
    </>
  ),
  clock: (
    <>
      <circle cx="7" cy="7" r="5" />
      <path d="M7 4v3l2 1.5" />
    </>
  ),
  link: (
    <>
      <path d="M6 8a2 2 0 002.8 0l2.5-2.5a2 2 0 10-2.8-2.8L8 3.2" />
      <path d="M8 6a2 2 0 00-2.8 0L2.7 8.5a2 2 0 102.8 2.8L6 10.8" />
    </>
  ),
  share: (
    <>
      <path d="M7 1.5v8M4 4.5L7 1.5l3 3" />
      <path d="M2.5 8.5v3.5a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V8.5" />
    </>
  ),
  download: (
    <>
      <path d="M7 1.5v8M4 6.5L7 9.5l3-3" />
      <path d="M2.5 11.5h9" />
    </>
  ),
  pen: <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9z" />,
  side: (
    <>
      <rect x="2" y="3" width="10" height="8" rx="1" />
      <path d="M5.5 3v8" />
    </>
  ),
  chevR: <path d="M5 3l4 4-4 4" />,
  chevL: <path d="M9 3l-4 4 4 4" />,
  chevD: <path d="M3 5l4 4 4-4" />,
  check: <path d="M3 7.5l2.5 2.5L11 4.5" />,
  more: (
    <>
      <circle cx="3" cy="7" r="1.1" fill="currentColor" />
      <circle cx="7" cy="7" r="1.1" fill="currentColor" />
      <circle cx="11" cy="7" r="1.1" fill="currentColor" />
    </>
  ),
  settings: (
    <>
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.6 2.6l1.1 1.1M10.3 10.3l1.1 1.1M2.6 11.4l1.1-1.1M10.3 3.7l1.1-1.1" />
    </>
  ),
  bot: (
    <>
      <rect x="2.5" y="4" width="9" height="7" rx="2" />
      <circle cx="5.5" cy="7.5" r="0.6" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.6" fill="currentColor" />
      <path d="M7 1.5v2.5M5.5 11v1M8.5 11v1" />
    </>
  ),
  vid: (
    <>
      <rect x="1.5" y="4" width="8" height="6" rx="1.2" />
      <path d="M9.5 6.5L12.5 5v4l-3-1.5z" />
    </>
  ),
  signal: <path d="M2 9.5h1.5v2H2zM5 7.5h1.5v4H5zM8 5.5h1.5v6H8zM11 3.5h1.5v8H11z" />,
  archive: <path d="M2 3h10v2H2zM3 5v6.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V5M6 7.5h2" />,
  filter: <path d="M2 3h10l-4 4.5V12L6 11V7.5z" />,
  copy: (
    <>
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <path d="M5 11v.5a.5.5 0 00.5.5h6a.5.5 0 00.5-.5v-6a.5.5 0 00-.5-.5H11" />
    </>
  ),
  signout: (
    <>
      <path d="M6 3.5H3a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h3" />
      <path d="M8.5 7H12M10.5 5L12 7l-1.5 2" />
    </>
  ),
  close: <path d="M4 4l6 6M10 4l-6 6" />,
  bold: <path d="M4.5 2.5h3a2 2 0 010 4h-3zM4.5 6.5h3.5a2.25 2.25 0 010 4.5H4.5zM4.5 2.5v8.5" />,
  italic: <path d="M6 2.5h5M3 11.5h5M8.5 2.5l-3 9" />,
  strike: (
    <>
      <path d="M2 7h10" />
      <path d="M9.5 4.2c-.3-1-1.3-1.7-2.5-1.7-1.4 0-2.5.8-2.5 2 0 .9.5 1.4 1.5 1.8M4.5 9.8c.3 1 1.3 1.7 2.5 1.7 1.4 0 2.5-.8 2.5-2 0-.4-.1-.8-.3-1.1" />
    </>
  ),
  quote: <path d="M3 8.5c-.6-.6-1-1.4-1-2.4C2 4.4 3.2 3 4.8 3M3 8.5c0 .8.7 1.5 1.5 1.5S6 9.3 6 8.5 5.3 7 4.5 7 3 7.7 3 8.5zM9 8.5c-.6-.6-1-1.4-1-2.4C8 4.4 9.2 3 10.8 3M9 8.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5S11.3 7 10.5 7 9 7.7 9 8.5z" />,
  olist: (
    <>
      <path d="M6 3.5h6M6 7h6M6 10.5h6" />
      <path d="M2 2.5l1-.5v3M2 5h2M2 8h1.8L2 10h2M2 11.5h1.5a.75.75 0 010 1.5" strokeWidth={1} />
    </>
  ),
  undo: (
    <>
      <path d="M2.5 5.5h6a3 3 0 010 6H5" />
      <path d="M5 3L2.5 5.5 5 8" />
    </>
  ),
  redo: (
    <>
      <path d="M11.5 5.5h-6a3 3 0 000 6H9" />
      <path d="M9 3l2.5 2.5L9 8" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 14, strokeWidth = 1.3, className, ...rest }: IconProps) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <svg
      viewBox="0 0 14 14"
      width={size}
      height={size}
      fill={name === 'more' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  )
}
