import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import DataGrid from '../components/DataGrid'
import SearchFilter from '../components/SearchFilter'
import ExportButton from '../components/ExportButton'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

const anomalyColumns = [
  { key: 'satellite_name', label: 'Satellite' },
  { key: 'reported_at', label: 'Reported', type: 'date' },
  { key: 'severity', label: 'Severity', type: 'status' },
  { key: 'description', label: 'Description' },
  { key: 'resolved', label: 'Resolved', type: 'status' },
  { key: 'resolution_note', label: 'Resolution Note' },
]

const severityFilters = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

const resolvedFilters = [
  { value: 'N', label: 'Open' },
  { value: 'Y', label: 'Resolved' },
]

export default function Anomalies() {
  const [anomalies, setAnomalies] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingAnomaly, setEditingAnomaly] = useState(null)
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
    if (filters.severity) params.append('severity', filters.severity)
    if (filters.resolved) params.append('resolved', filters.resolved)

    api.get(`/anomalies?${params}`)
      .then(res => {
        if (!cancelled) {
          setAnomalies(res.data.items || [])
          setTotal(res.data.total || 0)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load anomalies')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, filters])

  const handleSave = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = Object.fromEntries(formData)
    payload.satellite_id = parseInt(payload.satellite_id)
    payload.reported_by = parseInt(payload.reported_by)

    try {
      if (editingAnomaly) {
        await api.put(`/anomalies/${editingAnomaly.anomaly_id}`, payload)
      } else {
        await api.post('/anomalies', payload)
      }
      setShowModal(false)
      setEditingAnomaly(null)
      // Trigger re-fetch by bumping page or using a refresh flag
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save anomaly')
    }
  }

  const handleDelete = async (anomaly) => {
    if (!confirm('Delete this anomaly?')) return
    try {
      await api.delete(`/anomalies/${anomaly.anomaly_id}`)
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete anomaly')
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
          <ExportButton reportType="ANOMALY_REPORT" />
          {hasRole(['ADMIN', 'OPERATOR']) && (
            <button onClick={() => { setEditingAnomaly(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Report Anomaly
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
        onSearch={() => {}}
        onFilter={setFilters}
        filters={[
          { key: 'severity', label: 'Severity', options: severityFilters },
          { key: 'resolved', label: 'Status', options: resolvedFilters },
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
                <label className="block text-sm font-medium text-space-700 mb-1">Reported By (Operator ID) *</label>
                <input name="reported_by" type="number" defaultValue={editingAnomaly?.reported_by} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Reported At</label>
                <input name="reported_at" type="datetime-local" defaultValue={editingAnomaly?.reported_at?.slice(0, 16)} className="input-field" />
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
                  <label className="block text-sm font-medium text-space-700 mb-1">Resolved</label>
                  <select name="resolved" defaultValue={editingAnomaly?.resolved || 'N'} className="input-field">
                    <option value="N">No</option>
                    <option value="Y">Yes</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Description *</label>
                <textarea name="description" defaultValue={editingAnomaly?.description} rows={3} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-space-700 mb-1">Resolution Note</label>
                <textarea name="resolution_note" defaultValue={editingAnomaly?.resolution_note} rows={2} className="input-field" />
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