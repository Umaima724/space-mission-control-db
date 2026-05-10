import { useState, useEffect } from 'react'
import api from '../services/api'

export function useDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/dashboard')
        setData(response.data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  return { data, loading, error }
}