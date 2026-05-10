import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import ExportButton from '../components/ExportButton'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'

const satelliteColumns = [
  { key: 'satellite_name', label: 'Satellite' },
  { key: 'norad_id', label: 'NORAD ID' },
  { key: 'mission_name', label: 'Mission' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'orbit_type', label: 'Orbit' },
  { key: 'altitude_km', label: 'Altitude (km)' },
  { key: 'health_score', label: 'Health %' },
]

const statusFilters = [
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'DEGRADED', label: 'Degraded' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
]

export default function Satellites() {
  const [satellites, setSatellites] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingSatellite, setEditingSatellite] = useState(null)
  const { get, post, put, del, loading } = useApi()
  const { hasRole } = useAuth()

  const fetchSatellites = useCallback(async () => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('page_size', 10)
    if (search) params.append('search', search)
    if (filters.status) params.append('status', filters.status)

    const data = await get(`/satellites?${params}`)
    setSatellites(data.items || [])
    setTotal(data.total || 0)
  }, [page, search, filters, get])

  useEffect(() => {
    fetchSatellites()
  }, [fetchSatellites])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    if (payload.mission_id) payload.mission_id = parseInt(payload.mission_id)
    if (payload.altitude_km) payload.altitude_km = parseFloat(payload.altitude_km)
    if (payload.health_score) payload.health_score = parseFloat(payload.health_score)

    try {
      if (editingSatellite) {
        await put(`/satellites/${editingSatellite.satellite_id}`, payload)
      } else {
        await post('/satellites', payload)
      }
      setShowModal(false)
      setEditingSatellite(null)
      fetchSatellites()
    } catch {
      // handled by useApi
    }
  }

  const handleDelete = async (sat) => {
    if (!confirm('Delete this satellite?')) return
    try {
      await del(`/satellites/${sat.satellite_id}`)
      fetchSatellites()
    } catch {
      // handled by useApi
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-space-900">Satellites</h1>
          <p className="text-space-400 mt-1">Monitor and manage satellites</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton reportType="SATELLITES" />
          {hasRole(['ADMIN', 'OPERATOR']) && (
            <button onClick={() => { setEditingSatellite(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Satellite
            </button>
          )}
        </div>
      </div>

      <SearchFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={[{ key: 'status', label: 'Status', options: statusFilters }]}
        placeholder="Search satellites..."
      />

      <DataGrid
        columns={satelliteColumns}
        data={satellites}
        loading={loading}
        page={page}
        pageSize={10}
        total={total}
        onPageChange={setPage}
        onEdit={(s) => { setEditingSatellite(s); setShowModal(true) }}
        onDelete={handleDelete}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b border-space-200">
              <h2 className="text-lg font-bold text-space-900">
                {editingSatellite ? 'Edit Satellite' : 'New Satellite'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-space-100 rounded-lg">
                <X className="w-5 h-5 text-space-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Satellite Name *</label>
                <input name="satellite_name" defaultValue={editingSatellite?.satellite_name} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">NORAD ID</label>
                  <input name="norad_id" defaultValue={editingSatellite?.norad_id} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Mission ID</label>
                  <input name="mission_id" type="number" defaultValue={editingSatellite?.mission_id} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Launch Date</label>
                  <input name="launch_date" type="date" defaultValue={editingSatellite?.launch_date?.split('T')[0]} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Orbit Type</label>
                  <input name="orbit_type" defaultValue={editingSatellite?.orbit_type} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Altitude (km)</label>
                  <input name="altitude_km" type="number" step="0.1" defaultValue={editingSatellite?.altitude_km} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Health Score</label>
                  <input name="health_score" type="number" min="0" max="100" step="0.1" defaultValue={editingSatellite?.health_score} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Status</label>
                <select name="status" defaultValue={editingSatellite?.status || 'OPERATIONAL'} className="input-field">
                  <option value="OPERATIONAL">Operational</option>
                  <option value="DEGRADED">Degraded</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingSatellite ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}