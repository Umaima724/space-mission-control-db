import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'

const telemetryColumns = [
  { key: 'satellite_name', label: 'Satellite' },
  { key: 'timestamp', label: 'Timestamp', type: 'date' },
  { key: 'parameter_name', label: 'Parameter' },
  { key: 'parameter_value', label: 'Value' },
  { key: 'unit', label: 'Unit' },
  { key: 'data_source', label: 'Source' },
]

export default function Telemetry() {
  const [telemetry, setTelemetry] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const { get, post, loading } = useApi()
  const { hasRole } = useAuth()

  const fetchTelemetry = useCallback(async () => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('page_size', 50)
    if (search) params.append('search', search)
    if (filters.satellite_id) params.append('satellite_id', filters.satellite_id)

    const data = await get(`/telemetry?${params}`)
    setTelemetry(data.items || [])
    setTotal(data.total || 0)
  }, [page, search, filters, get])

  useEffect(() => {
    fetchTelemetry()
  }, [fetchTelemetry])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    payload.satellite_id = parseInt(payload.satellite_id)
    payload.parameter_value = parseFloat(payload.parameter_value)

    try {
      await post('/telemetry', payload)
      setShowModal(false)
      fetchTelemetry()
    } catch {
      // handled by useApi
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-space-900">Telemetry</h1>
          <p className="text-space-400 mt-1">View and add telemetry data</p>
        </div>
        {hasRole(['ADMIN', 'OPERATOR']) && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Telemetry
          </button>
        )}
      </div>

      <SearchFilter
        onSearch={setSearch}
        onFilter={setFilters}
        placeholder="Search telemetry..."
      />

      <DataGrid
        columns={telemetryColumns}
        data={telemetry}
        loading={loading}
        page={page}
        pageSize={50}
        total={total}
        onPageChange={setPage}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-space-200">
              <h2 className="text-lg font-bold text-space-900">Add Telemetry</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-space-100 rounded-lg">
                <X className="w-5 h-5 text-space-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Satellite ID *</label>
                <input name="satellite_id" type="number" className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Timestamp *</label>
                <input name="timestamp" type="datetime-local" className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Parameter Name *</label>
                <input name="parameter_name" className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Value *</label>
                  <input name="parameter_value" type="number" step="any" className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Unit</label>
                  <input name="unit" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Data Source</label>
                <input name="data_source" className="input-field" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}