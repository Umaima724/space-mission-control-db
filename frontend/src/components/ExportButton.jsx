import { Download, FileText, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import api from '../services/api'

export default function ExportButton({ reportType, disabled }) {
  const [loading, setLoading] = useState(false)

  const download = async (format) => {
    setLoading(true)
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
    } catch (err) {
      alert('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative group">
      <button
        disabled={disabled || loading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-space-800 text-white hover:bg-space-700 transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        <span className="text-sm font-medium">{loading ? 'Generating...' : 'Export'}</span>
      </button>
      
      <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-space-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button
          onClick={() => download('pdf')}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-space-50 rounded-t-xl"
        >
          <FileText className="w-4 h-4 text-red-500" />
          Export as PDF
        </button>
        <button
          onClick={() => download('csv')}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-space-50 rounded-b-xl"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          Export as CSV
        </button>
      </div>
    </div>
  )
}