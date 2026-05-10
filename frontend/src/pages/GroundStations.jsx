import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'

const stationColumns = [
  { key: 'station_name', label: 'Station' },
  { key: 'location', label: 'Location' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'elevation_m', label: 'Elevation (m)' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'antenna_count', label: 'Antennas' },
]

export default function GroundStations() {
  const [stations, setStations] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingStation, setEditingStation] = useState(null)
  const { get, post, put, del, loading } = useApi()
  const { hasRole } = useAuth()

  const fetchStations = useCallback(async () => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('page_size', 10)
    if (search) params.append('search', search)

    const data = await get(`/ground-stations?${params}`)
    setStations(data.items || [])
    setTotal(data.total || 0)
  }, [page, search, get])

  useEffect(() => {
    fetchStations()
  }, [fetchStations])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    if (payload.latitude) payload.latitude = parseFloat(payload.latitude)
    if (payload.longitude) payload.longitude = parseFloat(payload.longitude)
    if (payload.elevation_m) payload.elevation_m = parseFloat(payload.elevation_m)
    if (payload.antenna_count) payload.antenna_count = parseInt(payload.antenna_count)

    try {
      if (editingStation) {
        await put(`/ground-stations/${editingStation.station_id}`, payload)
      } else {
        await post('/ground-stations', payload)
      }
      setShowModal(false)
      setEditingStation(null)
      fetchStations()
    } catch {
      // handled
    }
  }

  const handleDelete = async (station) => {
    if (!confirm('Delete this ground station?')) return
    try {
      await del(`/ground-stations/${station.station_id}`)
      fetchStations()
    } catch {
      // handled
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

      <SearchFilter
        onSearch={setSearch}
        onFilter={setFilters}
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
                <label className="block text-sm font-medium text-space-700 mb-1">Station Name *</label>
                <input name="station_name" defaultValue={editingStation?.station_name} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Location</label>
                <input name="location" defaultValue={editingStation?.location} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Latitude</label>
                  <input name="latitude" type="number" step="any" defaultValue={editingStation?.latitude} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Longitude</label>
                  <input name="longitude" type="number" step="any" defaultValue={editingStation?.longitude} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Elevation (m)</label>
                  <input name="elevation_m" type="number" step="0.1" defaultValue={editingStation?.elevation_m} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Antenna Count</label>
                  <input name="antenna_count" type="number" defaultValue={editingStation?.antenna_count} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Status</label>
                <input name="status" defaultValue={editingStation?.status} className="input-field" />
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