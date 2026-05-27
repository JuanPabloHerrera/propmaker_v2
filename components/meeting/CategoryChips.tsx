'use client'

interface Props {
  categories: { name: string; count: number }[]
  selected: string[]
  onToggle: (category: string) => void
}

export function CategoryChips({ categories, selected, onToggle }: Props) {
  if (categories.length === 0) {
    return (
      <p className="text-xs text-[#6e6e73]">
        No catalog yet. <a href="/products/new" className="text-[#1d1d1f] underline">Add a product</a> to enable category targeting.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((cat) => {
        const active = selected.includes(cat.name)
        return (
          <button
            key={cat.name}
            type="button"
            onClick={() => onToggle(cat.name)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all flex items-center gap-1.5 ${
              active
                ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                : 'border-[#d2d2d7] text-[#1d1d1f] hover:border-[#6e6e73]'
            }`}
          >
            <span>{cat.name}</span>
            <span className={active ? 'text-white/60' : 'text-[#6e6e73]'}>{cat.count}</span>
          </button>
        )
      })}
    </div>
  )
}
