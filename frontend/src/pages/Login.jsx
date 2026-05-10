import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Satellite, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.append('username', username)
    formData.append('password', password)

    try {
      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      login(response.data)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-space-500 mb-4">
            <Satellite className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Space Mission Control</h1>
          <p className="text-space-300 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-space-800 rounded-2xl p-8 border border-space-600">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-space-200 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-space-700 border border-space-600 text-white placeholder-space-400 focus:border-space-500 focus:ring-2 focus:ring-space-500/20 outline-none transition-all"
                placeholder="admin, operator, or viewer"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-space-200 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-space-700 border border-space-600 text-white placeholder-space-400 focus:border-space-500 focus:ring-2 focus:ring-space-500/20 outline-none transition-all pr-12"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-space-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-space-500 text-white font-medium hover:bg-space-400 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-space-600">
            <p className="text-xs text-space-400 text-center mb-3">Demo Credentials</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-space-700 text-center">
                <p className="text-space-300 font-medium">admin</p>
                <p className="text-space-400">admin123</p>
              </div>
              <div className="p-2 rounded-lg bg-space-700 text-center">
                <p className="text-space-300 font-medium">operator</p>
                <p className="text-space-400">operator123</p>
              </div>
              <div className="p-2 rounded-lg bg-space-700 text-center">
                <p className="text-space-300 font-medium">viewer</p>
                <p className="text-space-400">viewer123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}