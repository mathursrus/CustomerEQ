'use client'

interface FilterOption {
  value: string
  label: string
}

interface Filter {
  key: string
  label: string
  options: FilterOption[]
}

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  filters: Filter[]
  filterValues: Record<string, string>
  onFilterChange: (key: string, value: string) => void
  placeholder?: string
}

export function FilterBar({
  search,
  onSearchChange,
  filters,
  filterValues,
  onFilterChange,
  placeholder = 'Search…',
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
      />
      {filters.map(filter => (
        <select
          key={filter.key}
          value={filterValues[filter.key] ?? ''}
          onChange={e => onFilterChange(filter.key, e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All {filter.label}s</option>
          {filter.options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  )
}
