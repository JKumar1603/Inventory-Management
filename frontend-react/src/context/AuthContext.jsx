import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    // Store token first so the interceptor can use it for /me
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    // Fetch full profile — token is now in localStorage
    const meRes = await api.get('/auth/me')
    const userData = {
      id: meRes.data.id,
      email: meRes.data.email,
      full_name: meRes.data.full_name,
      role: meRes.data.role,
      phone: meRes.data.phone,
      address: meRes.data.address,
    }
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const register = useCallback(async (formData) => {
    await api.post('/auth/register', formData)
  }, [])

  // Call after profile update to sync localStorage and state
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me')
      const userData = {
        id: res.data.id,
        email: res.data.email,
        full_name: res.data.full_name,
        role: res.data.role,
        phone: res.data.phone,
        address: res.data.address,
      }
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
    } catch {}
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
