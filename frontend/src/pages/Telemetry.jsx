import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

const telemetryColumns = [
  { key: 'satellite_name', label: 'Satellite' },
  { key: 'recorded_at', label: 'Recorded At', type: 'date' },
  { key: 'temperature_c', label: 'Temperature (°C)' },
  { key: 'battery_pct', label: 'Battery (%)' },
  { key: 'signal_dbm', label: 'Signal (dBm)' },
  { key: 'altitude_km', label: 'Altitude (km)' },
]

export default function Telemetry() {
  const [telemetry, setTelemetry] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { hasRole } = useAuth()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.append('page', page)
    params.append('page_size', 50)
    if (filters.satellite_id) params.append('satellite_id', filters.satellite_id)
    if (filters.date_from) params.append('date_from', filters.date_from)
    if (filters.date_to) params.append('date_to', filters.date_to)

    api.get(`/telemetry?${params}`)
      .then(res => {
        if (!cancelled) {
          setTelemetry(res.data.items || [])
          setTotal(res.data.total || 0)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load telemetry')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, filters])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    payload.satellite_id = parseInt(payload.satellite_id)
    payload.temperature_c = parseFloat(payload.temperature_c)
    if (payload.battery_pct) payload.battery_pct = parseFloat(payload.battery_pct)
    if (payload.signal_dbm) payload.signal_dbm = parseFloat(payload.signal_dbm)
    payload.altitude_km = parseFloat(payload.altitude_km)

    try {
      await api.post('/telemetry', payload)
      setShowModal(false)
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add telemetry')
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

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
                <label className="block text-sm font-medium text-space-700 mb-1">Recorded At *</label>
                <input name="recorded_at" type="datetime-local" className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Temperature (°C) *</label>
                <input name="temperature_c" type="number" step="0.01" className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Battery (%)</label>
                  <input name="battery_pct" type="number" min="0" max="100" step="0.01" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Signal (dBm)</label>
                  <input name="signal_dbm" type="number" min="-150" max="0" step="0.01" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Altitude (km) *</label>
                <input name="altitude_km" type="number" step="0.01" className="input-field" required />
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