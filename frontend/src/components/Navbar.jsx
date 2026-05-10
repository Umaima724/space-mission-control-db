import { Bell, Search } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
  const { user } = useAuth()

  return (
    <header className="bg-white border-b border-space-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-space-300" />
          <input
            type="text"
            placeholder="Search missions, satellites..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-space-100 border-none text-sm focus:ring-2 focus:ring-space-500/20 outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-xl hover:bg-space-100 transition-colors">
          <Bell className="w-5 h-5 text-space-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-space-200">
          <div className="w-9 h-9 rounded-full bg-space-500 flex items-center justify-center text-white font-bold text-sm">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-space-900">{user?.username}</p>
            <p className="text-xs text-space-400">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}