import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

const stationColumns = [
  { key: 'station_name', label: 'Station' },
  { key: 'location', label: 'Location' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'operational', label: 'Operational', type: 'status' },
  { key: 'frequency_range', label: 'Frequency Range' },
]

export default function GroundStations() {
  const [stations, setStations] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingStation, setEditingStation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { hasRole } = useAuth()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.append('page', page)
    params.append('page_size', 10)
    if (search) params.append('search', search)
    if (filters.operational) params.append('operational', filters.operational)

    api.get(`/ground-stations?${params}`)
      .then(res => {
        if (!cancelled) {
          setStations(res.data.items || [])
          setTotal(res.data.total || 0)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load stations')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, search, filters])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    if (payload.center_id) payload.center_id = parseInt(payload.center_id)
    if (payload.latitude) payload.latitude = parseFloat(payload.latitude)
    if (payload.longitude) payload.longitude = parseFloat(payload.longitude)

    try {
      if (editingStation) {
        await api.put(`/ground-stations/${editingStation.station_id}`, payload)
      } else {
        await api.post('/ground-stations', payload)
      }
      setShowModal(false)
      setEditingStation(null)
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save station')
    }
  }

  const handleDelete = async (station) => {
    if (!confirm('Delete this ground station?')) return
    try {
      await api.delete(`/ground-stations/${station.station_id}`)
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete station')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-space-900">Ground Stations</h1>
          <p className="text-space-400 mt-1">Manage ground communication stations</p>
        </div>
        {hasRole(['ADMIN', 'OPERATOR']) && (
          <button onClick={() => { setEditingStation(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Station
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
        filters={[
          { key: 'operational', label: 'Operational', options: [
            { value: 'Y', label: 'Yes' },
            { value: 'N', label: 'No' },
          ]},
        ]}
        placeholder="Search stations..."
      />

      <DataGrid
        columns={stationColumns}
        data={stations}
        loading={loading}
        page={page}
        pageSize={10}
        total={total}
        onPageChange={setPage}
        onEdit={(s) => { setEditingStation(s); setShowModal(true) }}
        onDelete={handleDelete}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-space-200">
              <h2 className="text-lg font-bold text-space-900">
                {editingStation ? 'Edit Station' : 'New Station'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-space-100 rounded-lg">
                <X className="w-5 h-5 text-space-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Center ID</label>
                <input name="center_id" type="number" defaultValue={editingStation?.center_id} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Station Name *</label>
                <input name="station_name" defaultValue={editingStation?.station_name} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Location *</label>
                <input name="location" defaultValue={editingStation?.location} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Latitude *</label>
                  <input name="latitude" type="number" step="any" defaultValue={editingStation?.latitude} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Longitude *</label>
                  <input name="longitude" type="number" step="any" defaultValue={editingStation?.longitude} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Operational</label>
                <select name="operational" defaultValue={editingStation?.operational || 'Y'} className="input-field">
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Frequency Range *</label>
                <input name="frequency_range" defaultValue={editingStation?.frequency_range} className="input-field" required />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingStation ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}