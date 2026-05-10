import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import ExportButton from '../components/ExportButton'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

const missionColumns = [
  { key: 'mission_name', label: 'Mission Name' },
  { key: 'mission_type', label: 'Type' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'launch_date', label: 'Launch Date', type: 'date' },
  { key: 'objective', label: 'Objective' },
  { key: 'agency_name', label: 'Agency' },
  { key: 'satellite_count', label: 'Satellites' },
]

const statusFilters = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ABORTED', label: 'Aborted' },
]

const typeFilters = [
  { value: 'CREWED', label: 'Crewed' },
  { value: 'UNCREWED', label: 'Uncrewed' },
]

export default function Missions() {
  const [missions, setMissions] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingMission, setEditingMission] = useState(null)
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
    if (filters.mission_type) params.append('mission_type', filters.mission_type)

    api.get(`/missions?${params}`)
      .then(res => {
        if (!cancelled) {
          setMissions(res.data.items || [])
          setTotal(res.data.total || 0)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load missions')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, search, filters])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)

    try {
      if (editingMission) {
        await api.put(`/missions/${editingMission.mission_id}`, payload)
      } else {
        await api.post('/missions', payload)
      }
      setShowModal(false)
      setEditingMission(null)
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save mission')
    }
  }

  const handleDelete = async (mission) => {
    if (!confirm('Delete this mission?')) return
    try {
      await api.delete(`/missions/${mission.mission_id}`)
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete mission')
    }
  }

  const openEdit = (mission) => {
    setEditingMission(mission)
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingMission(null)
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-space-900">Missions</h1>
          <p className="text-space-400 mt-1">Manage space missions</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton reportType="MISSIONS" />
          {hasRole(['ADMIN', 'OPERATOR']) && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Mission
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
        filters={[
          { key: 'status', label: 'Status', options: statusFilters },
          { key: 'mission_type', label: 'Type', options: typeFilters },
        ]}
        placeholder="Search missions..."
      />

      <DataGrid
        columns={missionColumns}
        data={missions}
        loading={loading}
        page={page}
        pageSize={10}
        total={total}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b border-space-200">
              <h2 className="text-lg font-bold text-space-900">
                {editingMission ? 'Edit Mission' : 'New Mission'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-space-100 rounded-lg">
                <X className="w-5 h-5 text-space-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Mission Name *</label>
                <input name="mission_name" defaultValue={editingMission?.mission_name} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Mission Type *</label>
                <select name="mission_type" defaultValue={editingMission?.mission_type || 'UNCREWED'} className="input-field" required>
                  <option value="CREWED">Crewed</option>
                  <option value="UNCREWED">Uncrewed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Launch Date *</label>
                <input name="launch_date" type="date" defaultValue={editingMission?.launch_date?.split('T')[0]} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Status</label>
                <select name="status" defaultValue={editingMission?.status || 'PLANNED'} className="input-field">
                  <option value="PLANNED">Planned</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ABORTED">Aborted</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Objective *</label>
                <textarea name="objective" defaultValue={editingMission?.objective} rows={3} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Agency Name *</label>
                <input name="agency_name" defaultValue={editingMission?.agency_name} className="input-field" required />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingMission ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}