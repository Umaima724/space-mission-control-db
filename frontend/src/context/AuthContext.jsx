import { createContext, useState, useEffect } from 'react'
import Cookies from 'js-cookie'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = Cookies.get('token')
    const savedUser = Cookies.get('user')
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        logout()
      }
    }
    setLoading(false)
  }, [])

  const login = (data) => {
    Cookies.set('token', data.access_token, { expires: 1 })
    const userData = { username: data.username, role: data.role }
    Cookies.set('user', JSON.stringify(userData), { expires: 1 })
    setUser(userData)
  }

  const logout = () => {
    Cookies.remove('token')
    Cookies.remove('user')
    setUser(null)
  }

  const hasRole = (roles) => {
    if (!user) return false
    return roles.includes(user.role)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole, loading }}>
      {children}
    </AuthContext.Provider>
  )
}