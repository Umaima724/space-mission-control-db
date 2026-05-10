import { NavLink, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Rocket, 
  Satellite, 
  Activity, 
  AlertTriangle, 
  Radio, 
  FileText, 
  LogOut 
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/missions', label: 'Missions', icon: Rocket },
  { path: '/satellites', label: 'Satellites', icon: Satellite },
  { path: '/telemetry', label: 'Telemetry', icon: Activity },
  { path: '/anomalies', label: 'Anomalies', icon: AlertTriangle },
  { path: '/ground-stations', label: 'Ground Stations', icon: Radio },
  { path: '/reports', label: 'Reports', icon: FileText },
]

export default function Sidebar() {
  const { logout, user } = useAuth()
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-space-800 text-white flex flex-col">
      <div className="p-6 border-b border-space-600">
        <div className="flex items-center gap-3">
          <Satellite className="w-8 h-8 text-space-400" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Space Mission</h1>
            <p className="text-xs text-space-300">Control Center</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-space-500 text-white shadow-lg shadow-space-500/25' 
                  : 'text-space-300 hover:bg-space-700 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="p-4 border-t border-space-600">
        <div className="mb-3 px-4">
          <p className="text-xs text-space-300">Logged in as</p>
          <p className="text-sm font-medium text-white">{user?.username}</p>
          <span className="badge bg-space-600 text-space-300 mt-1">{user?.role}</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </aside>
  )
}