const REPO_URL = 'https://github.com/JuanPabloHerrera/propmaker_v2'

/**
 * Small fixed pill in the bottom-right corner showing the app version and the
 * git commit it was built from. Links to that exact commit on GitHub so you can
 * confirm the running deploy matches the latest pushed commit. Values are baked
 * in at build time via next.config.ts (NEXT_PUBLIC_APP_VERSION / NEXT_PUBLIC_GIT_SHA).
 */
export function VersionPill() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? ''
  const sha = process.env.NEXT_PUBLIC_GIT_SHA ?? ''
  const short = sha ? sha.slice(0, 7) : 'dev'
  const label = `v${version || '0.0.0'} · ${short}`
  const href = sha ? `${REPO_URL}/commit/${sha}` : REPO_URL

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="pm-no-print pill pill-mono opacity-50 hover:opacity-100 transition-opacity"
      title={sha ? `Build ${short} — open this commit on GitHub to verify the latest version` : 'Local dev build'}
      style={{
        position: 'fixed',
        right: 10,
        bottom: 10,
        zIndex: 40,
        textDecoration: 'none',
      }}
    >
      {label}
    </a>
  )
}
