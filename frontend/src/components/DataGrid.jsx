import { useState } from 'react'
import { ChevronLeft, ChevronRight, Edit, Trash2, Eye } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function DataGrid({ 
  columns, 
  data, 
  onEdit, 
  onDelete, 
  onView,
  loading,
  page,
  pageSize,
  total,
  onPageChange 
}) {
  const { hasRole } = useAuth()
  const totalPages = Math.ceil(total / pageSize) || 1

  const getStatusColor = (status) => {
    const colors = {
      ACTIVE: 'bg-emerald-100 text-emerald-700',
      OPERATIONAL: 'bg-emerald-100 text-emerald-700',
      PLANNED: 'bg-blue-100 text-blue-700',
      COMPLETED: 'bg-space-100 text-space-700',
      ABORTED: 'bg-red-100 text-red-700',
      DEGRADED: 'bg-amber-100 text-amber-700',
      OFFLINE: 'bg-red-100 text-red-700',
      MAINTENANCE: 'bg-purple-100 text-purple-700',
      OPEN: 'bg-red-100 text-red-700',
      INVESTIGATING: 'bg-amber-100 text-amber-700',
      RESOLVED: 'bg-emerald-100 text-emerald-700',
      CLOSED: 'bg-space-100 text-space-700',
      CRITICAL: 'bg-red-100 text-red-700',
      HIGH: 'bg-orange-100 text-orange-700',
      MEDIUM: 'bg-amber-100 text-amber-700',
      LOW: 'bg-blue-100 text-blue-700',
    }
    return colors[status] || 'bg-space-100 text-space-700'
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-space-500"></div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-space-50">
              {columns.map((col) => (
                <th key={col.key} className="table-header">{col.label}</th>
              ))}
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-8 text-space-400">
                  No data found
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-space-50/50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="table-cell">
                      {col.type === 'status' ? (
                        <span className={`badge ${getStatusColor(row[col.key])}`}>
                          {row[col.key]}
                        </span>
                      ) : col.type === 'date' ? (
                        row[col.key] ? new Date(row[col.key]).toLocaleDateString() : '-'
                      ) : col.type === 'money' ? (
                        row[col.key] ? `$${Number(row[col.key]).toLocaleString()}` : '-'
                      ) : (
                        row[col.key] || '-'
                      )}
                    </td>
                  ))}
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {onView && (
                        <button onClick={() => onView(row)} className="p-1.5 rounded-lg hover:bg-space-100 text-space-400 hover:text-space-600 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {onEdit && hasRole(['ADMIN', 'OPERATOR']) && (
                        <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-50 text-space-400 hover:text-blue-600 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && hasRole(['ADMIN']) && (
                        <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg hover:bg-red-50 text-space-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-space-100">
          <p className="text-sm text-space-400">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-space-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-space-700 px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-space-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}