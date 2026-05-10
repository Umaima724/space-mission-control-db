import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import ExportButton from '../components/ExportButton'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'

const anomalyColumns = [
  { key: 'satellite_name', label: 'Satellite' },
  { key: 'detected_at', label: 'Detected', type: 'date' },
  { key: 'severity', label: 'Severity', type: 'status' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'resolved_at', label: 'Resolved', type: 'date' },
]

const severityFilters = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

const statusFilters = [
  { value: 'OPEN', label: 'Open' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

export default function Anomalies() {
  const [anomalies, setAnomalies] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingAnomaly, setEditingAnomaly] = useState(null)
  const { get, post, put, del, loading } = useApi()
  const { hasRole } = useAuth()

  const fetchAnomalies = useCallback(async () => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('page_size', 10)
    if (filters.severity) params.append('severity', filters.severity)
    if (filters.status) params.append('status', filters.status)

    const data = await get(`/anomalies?${params}`)
    setAnomalies(data.items || [])
    setTotal(data.total || 0)
  }, [page, filters, get])

  useEffect(() => {
    fetchAnomalies()
  }, [fetchAnomalies])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    payload.satellite_id = parseInt(payload.satellite_id)

    try {
      if (editingAnomaly) {
        await put(`/anomalies/${editingAnomaly.anomaly_id}`, payload)
      } else {
        await post('/anomalies', payload)
      }
      setShowModal(false)
      setEditingAnomaly(null)
      fetchAnomalies()
    } catch {
      // handled
    }
  }

  const handleDelete = async (anomaly) => {
    if (!confirm('Delete this anomaly?')) return
    try {
      await del(`/anomalies/${anomaly.anomaly_id}`)
      fetchAnomalies()
    } catch {
      // handled
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-space-900">Anomalies</h1>
          <p className="text-space-400 mt-1">Track and resolve anomalies</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton reportType="ANOMALIES" />
          {hasRole(['ADMIN', 'OPERATOR']) && (
            <button onClick={() => { setEditingAnomaly(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Report Anomaly
            </button>
          )}
        </div>
      </div>

      <SearchFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={[
          { key: 'severity', label: 'Severity', options: severityFilters },
          { key: 'status', label: 'Status', options: statusFilters },
        ]}
        placeholder="Search anomalies..."
      />

      <DataGrid
        columns={anomalyColumns}
        data={anomalies}
        loading={loading}
        page={page}
        pageSize={10}
        total={total}
        onPageChange={setPage}
        onEdit={(a) => { setEditingAnomaly(a); setShowModal(true) }}
        onDelete={handleDelete}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-space-200">
              <h2 className="text-lg font-bold text-space-900">
                {editingAnomaly ? 'Edit Anomaly' : 'Report Anomaly'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-space-100 rounded-lg">
                <X className="w-5 h-5 text-space-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Satellite ID *</label>
                <input name="satellite_id" type="number" defaultValue={editingAnomaly?.satellite_id} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Detected At *</label>
                <input name="detected_at" type="datetime-local" defaultValue={editingAnomaly?.detected_at?.slice(0, 16)} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Severity *</label>
                  <select name="severity" defaultValue={editingAnomaly?.severity || 'MEDIUM'} className="input-field">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-space-700 mb-1">Status</label>
                  <select name="status" defaultValue={editingAnomaly?.status || 'OPEN'} className="input-field">
                    <option value="OPEN">Open</option>
                    <option value="INVESTIGATING">Investigating</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Description *</label>
                <textarea name="description" defaultValue={editingAnomaly?.description} rows={3} className="input-field" required />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingAnomaly ? 'Update' : 'Report'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}