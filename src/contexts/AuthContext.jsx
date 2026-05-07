import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gympods_staff')
      if (saved) setStaff(JSON.parse(saved))
    } catch (e) {
      localStorage.removeItem('gympods_staff')
    }
    setLoading(false)
  }, [])

  // siteId is now required — same PIN can exist across multiple sites
  const loginWithPin = async (pin, siteId) => {
    const { data, error } = await supabase
      .from('staff')
      .select('*, sites(name, address)')
      .eq('pin', pin)
      .eq('site_id', siteId)
      .eq('active', true)
      .single()

    if (error || !data) return { success: false, error: 'Invalid PIN' }

    localStorage.setItem('gympods_staff', JSON.stringify(data))
    setStaff(data)
    return { success: true, staff: data }
  }

  const logout = () => {
    setStaff(null)
    localStorage.removeItem('gympods_staff')
  }

  const isAdmin  = () => staff && (staff.role === 'admin' || staff.role === 'hq')
  const isHQ     = () => staff && staff.role === 'hq'
  const isSenior = () => staff && (staff.role === 'senior_foh' || isAdmin())

  return (
    <AuthContext.Provider value={{ staff, loading, loginWithPin, logout, isAdmin, isHQ, isSenior }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
