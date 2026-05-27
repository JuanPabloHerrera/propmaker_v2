export default function PublicProposalNotFound() {
  return (
    <div className="min-h-screen lg-shell grid place-items-center" style={{ padding: 32 }}>
      <div
        className="card text-center"
        style={{ padding: '28px 32px', maxWidth: 440 }}
      >
        <div
          className="pm-eyebrow mb-1.5"
          style={{ color: 'var(--ink-3)' }}
        >
          404
        </div>
        <h1
          className="text-[16px] font-semibold mb-2"
          style={{ color: 'var(--ink-1)' }}
        >
          Proposal not found
        </h1>
        <p
          className="text-[12.5px] leading-relaxed"
          style={{ color: 'var(--ink-2)' }}
        >
          The link is invalid, the proposal was unpublished, or the slug was
          renamed.
        </p>
      </div>
    </div>
  )
}
