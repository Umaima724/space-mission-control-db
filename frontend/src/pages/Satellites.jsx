import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import ExportButton from '../components/ExportButton'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

const satelliteColumns = [
  { key: 'satellite_name', label: 'Satellite' },
  { key: 'mission_name', label: 'Mission' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'mass_kg', label: 'Mass (kg)' },
  { key: 'frequency_mhz', label: 'Frequency (MHz)' },
  { key: 'launch_date', label: 'Launch Date', type: 'date' },
]

const statusFilters = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'DECOMMISSIONED', label: 'Decommissioned' },
]

export default function Satellites() {
  const [satellites, setSatellites] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingSatellite, setEditingSatellite] = useState(null)
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
    if (filters.status) params.append('status', filters.status)

    api.get(`/satellites?${params}`)
      .then(res => {
        if (!cancelled) {
          setSatellites(res.data.items || [])
          setTotal(res.data.total || 0)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load satellites')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, search, filters])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    if (payload.mission_id) payload.mission_id = parseInt(payload.mission_id)
    if (payload.orbit_id) payload.orbit_id = parseInt(payload.orbit_id)
    if (payload.mass_kg) payload.mass_kg = parseFloat(payload.mass_kg)
    if (payload.frequency_mhz) payload.frequency_mhz = parseFloat(payload.frequency_mhz)

    try {
      if (editingSatellite) {
        await api.put(`/satellites/${editingSatellite.satellite_id}`, payload)
      } else {
        await api.post('/satellites', payload)
      }
      setShowModal(false)
      setEditingSatellite(null)
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save satellite')
    }
  }

  const handleDelete = async (sat) => {
    if (!confirm('Delete this satellite?')) return
    try {
      await api.delete(`/satellites/${sat.satellite_id}`)
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete satellite')
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

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
                  <label className="block text-sm font-medium text-space-700 mb-1">Mission ID *</label>
                  <input name="mission_id" type="number" defaultValue={editingSatellite?.mission_id} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Orbit ID</label>
                  <input name="orbit_id" type="number" defaultValue={editingSatellite?.orbit_id} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Launch Date *</label>
                <input name="launch_date" type="date" defaultValue={editingSatellite?.launch_date?.split('T')[0]} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Mass (kg) *</label>
                  <input name="mass_kg" type="number" step="0.01" defaultValue={editingSatellite?.mass_kg} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Frequency (MHz) *</label>
                  <input name="frequency_mhz" type="number" step="0.001" defaultValue={editingSatellite?.frequency_mhz} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Status</label>
                <select name="status" defaultValue={editingSatellite?.status || 'ACTIVE'} className="input-field">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="DECOMMISSIONED">Decommissioned</option>
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