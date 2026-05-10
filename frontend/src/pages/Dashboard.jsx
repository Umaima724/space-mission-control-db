import KpiCard from '../components/KpiCard'
import ChartWidget from '../components/ChartWidget'
import { useDashboard } from '../hooks/useDashboard'

export default function Dashboard() {
  const { data, loading, error } = useDashboard()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-space-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  const { kpis, charts } = data || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-space-900">Dashboard</h1>
        <p className="text-space-400 mt-1">Overview of your space mission operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis?.map((kpi, idx) => (
          <KpiCard key={idx} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWidget
          title="Mission Status Distribution"
          type="pie"
          data={charts?.missionStatus?.data || []}
          labels={charts?.missionStatus?.labels || []}
        />
        <ChartWidget
          title="Satellite Status"
          type="pie"
          data={charts?.satelliteStatus?.data || []}
          labels={charts?.satelliteStatus?.labels || []}
        />
        <ChartWidget
          title="Active Anomalies by Severity"
          type="bar"
          data={charts?.anomalySeverity?.data || []}
          labels={charts?.anomalySeverity?.labels || []}
        />
        <ChartWidget
          title="Telemetry Volume (Last 7 Days)"
          type="line"
          data={charts?.telemetryVolume?.data || []}
          labels={charts?.telemetryVolume?.labels || []}
        />
      </div>
    </div>
  )
}