import { useState, useCallback } from 'react'
import api from '../services/api'

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const request = useCallback(async (method, url, data = null, config = {}) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api[method](url, data, config)
      setLoading(false)
      return response.data
    } catch (err) {
      setLoading(false)
      setError(err.response?.data?.detail || err.message || 'Something went wrong')
      throw err
    }
  }, [])

  const get = (url, config) => request('get', url, null, config)
  const post = (url, data, config) => request('post', url, data, config)
  const put = (url, data, config) => request('put', url, data, config)
  const del = (url, config) => request('delete', url, null, config)

  return { loading, error, get, post, put, del }
}