import { 
  Rocket, 
  Satellite, 
  AlertTriangle, 
  Radio, 
  Activity,
  TrendingUp, 
  TrendingDown 
} from 'lucide-react'

const iconMap = {
  Rocket: Rocket,
  Satellite: Satellite,
  AlertTriangle: AlertTriangle,
  Radio: Radio,
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  yellow: 'bg-amber-50 text-amber-600',
  purple: 'bg-violet-50 text-violet-600',
}

export default function KpiCard({ title, value, change, icon, color }) {
  const Icon = iconMap[icon] || Activity
  const colorClass = colorMap[color] || colorMap.blue

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-space-400 font-medium">{title}</p>
          <h3 className="text-2xl font-bold text-space-900 mt-1">{value}</h3>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change > 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-xs font-medium ${change > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {change} active
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}