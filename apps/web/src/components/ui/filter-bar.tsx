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
  filters?: Filter[]
  filterValues?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  placeholder?: string
}

export function FilterBar({
  search,
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  placeholder = 'Search...',
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-48 flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={filterValues[filter.key] ?? ''}
          onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">{filter.label}: All</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  )
}
