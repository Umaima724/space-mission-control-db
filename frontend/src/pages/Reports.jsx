import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import api from '../services/api'

const reportTypes = [
  { id: 'MISSIONS', label: 'Missions Report', description: 'Complete mission data with budgets and timelines' },
  { id: 'SATELLITES', label: 'Satellites Report', description: 'Satellite inventory and health status' },
  { id: 'TELEMETRY', label: 'Telemetry Report', description: 'All telemetry readings and parameters' },
  { id: 'ANOMALIES', label: 'Anomalies Report', description: 'Anomaly tracking and resolution history' },
]

export default function Reports() {
  const [generating, setGenerating] = useState(null)

  const download = async (reportType, format) => {
    setGenerating(`${reportType}-${format}`)
    try {
      const response = await api.post('/reports/generate', {
        report_type: reportType,
        format: format,
      }, { responseType: 'blob' })

      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${reportType.toLowerCase()}_report.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Failed to generate report')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-space-900">Reports</h1>
        <p className="text-space-400 mt-1">Generate and download reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report) => (
          <div key={report.id} className="card flex flex-col">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-xl bg-space-100">
                <FileText className="w-6 h-6 text-space-500" />
              </div>
              <div>
                <h3 className="font-semibold text-space-900">{report.label}</h3>
                <p className="text-sm text-space-400 mt-1">{report.description}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-auto">
              <button
                onClick={() => download(report.id, 'pdf')}
                disabled={generating === `${report.id}-pdf`}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium text-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {generating === `${report.id}-pdf` ? 'Generating...' : 'PDF'}
              </button>
              <button
                onClick={() => download(report.id, 'csv')}
                disabled={generating === `${report.id}-csv`}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors font-medium text-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {generating === `${report.id}-csv` ? 'Generating...' : 'CSV'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}