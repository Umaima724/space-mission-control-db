import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import ExportButton from '../components/ExportButton'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'

const missionColumns = [
  { key: 'mission_name', label: 'Mission Name' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'launch_date', label: 'Launch Date', type: 'date' },
  { key: 'end_date', label: 'End Date', type: 'date' },
  { key: 'budget', label: 'Budget', type: 'money' },
  { key: 'lead_agency', label: 'Agency' },
  { key: 'satellite_count', label: 'Satellites' },
]

const statusFilters = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ABORTED', label: 'Aborted' },
]

export default function Missions() {
  const [missions, setMissions] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingMission, setEditingMission] = useState(null)
  const { get, post, put, del, loading } = useApi()
  const { hasRole } = useAuth()

  const fetchMissions = useCallback(async () => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('page_size', 10)
    if (search) params.append('search', search)
    if (filters.status) params.append('status', filters.status)

    const data = await get(`/missions?${params}`)
    setMissions(data.items || [])
    setTotal(data.total || 0)
  }, [page, search, filters, get])

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    if (payload.budget) payload.budget = parseFloat(payload.budget)

    try {
      if (editingMission) {
        await put(`/missions/${editingMission.mission_id}`, payload)
      } else {
        await post('/missions', payload)
      }
      setShowModal(false)
      setEditingMission(null)
      fetchMissions()
    } catch {
      // error handled by useApi
    }
  }

  const handleDelete = async (mission) => {
    if (!confirm('Delete this mission?')) return
    try {
      await del(`/missions/${mission.mission_id}`)
      fetchMissions()
    } catch {
      // error handled by useApi
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

      <SearchFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={[{ key: 'status', label: 'Status', options: statusFilters }]}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Launch Date</label>
                  <input name="launch_date" type="date" defaultValue={editingMission?.launch_date?.split('T')[0]} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">End Date</label>
                  <input name="end_date" type="date" defaultValue={editingMission?.end_date?.split('T')[0]} className="input-field" />
                </div>
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
                <label className="block text-sm font-medium text-space-700 mb-1">Objective</label>
                <textarea name="objective" defaultValue={editingMission?.objective} rows={3} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Budget</label>
                  <input name="budget" type="number" step="0.01" defaultValue={editingMission?.budget} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Lead Agency</label>
                  <input name="lead_agency" defaultValue={editingMission?.lead_agency} className="input-field" />
                </div>
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