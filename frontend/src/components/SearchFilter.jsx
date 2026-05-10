import { Search, Filter, X } from 'lucide-react'
import { useState } from 'react'

export default function SearchFilter({ 
  onSearch, 
  onFilter, 
  filters = [],
  placeholder = "Search..." 
}) {
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilters, setActiveFilters] = useState({})

  const handleSearch = (e) => {
    const value = e.target.value
    setSearch(value)
    onSearch(value)
  }

  const handleFilterChange = (key, value) => {
    const newFilters = { ...activeFilters, [key]: value }
    if (!value) delete newFilters[key]
    setActiveFilters(newFilters)
    onFilter(newFilters)
  }

  const clearFilters = () => {
    setActiveFilters({})
    setSearch('')
    onSearch('')
    onFilter({})
  }

  const hasActiveFilters = Object.keys(activeFilters).length > 0 || search

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-space-300" />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-space-200 focus:border-space-500 focus:ring-2 focus:ring-space-500/20 outline-none bg-white"
          />
        </div>
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors ${
              showFilters ? 'bg-space-500 text-white border-space-500' : 'border-space-200 hover:bg-space-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
          </button>
        )}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-medium">Clear</span>
          </button>
        )}
      </div>

      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-white rounded-xl border border-space-200">
          {filters.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-space-400">{filter.label}</label>
              <select
                value={activeFilters[filter.key] || ''}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                className="px-3 py-2 rounded-lg border border-space-200 text-sm focus:border-space-500 outline-none bg-white min-w-[140px]"
              >
                <option value="">All</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}