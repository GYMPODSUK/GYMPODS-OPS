import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hasMinRole } from '../lib/permissions'

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

  /**
   * Login with PIN at a chosen site.
   *
   * Access (priority order):
   *   1. Site staff (site_id matches the chosen site)
   *   2. Region Manager (region_id matches the site's region)
   *   3. HQ (site_id = NULL, can enter any site)
   *
   * This is what fixes the Putney 9999 bug.
   */
  const loginWithPin = async (pin, siteId) => {
    // 1. Resolve site so we know its region
    const { data: site, error: siteErr } = await supabase
      .from('sites')
      .select('id, name, address, region_id, regions(name)')
      .eq('id', siteId)
      .single()

    if (siteErr || !site) {
      return { success: false, error: 'Site not found' }
    }

    // 2. Find active staff matching this PIN
    const { data: matches, error: staffErr } = await supabase
      .from('staff')
      .select('*, sites(name, address)')
      .eq('pin', pin)
      .eq('active', true)

    if (staffErr || !matches || matches.length === 0) {
      return { success: false, error: 'Invalid PIN' }
    }

    // 3. Pick best match in priority order
    const match =
      matches.find(m => m.site_id === siteId) ||
      matches.find(m => m.role === 'region_manager' && m.region_id === site.region_id) ||
      matches.find(m => m.role === 'hq')

    if (!match) {
      return { success: false, error: 'Invalid PIN' }
    }

    // 4. Build session.
    //    active_site_id = the site they're currently viewing (always set).
    //    For regular staff this equals their site_id.
    //    For HQ / Region Mgr this is the site they picked at login.
    const session = {
      ...match,
      active_site_id:   site.id,
      active_site:      { id: site.id, name: site.name, address: site.address, region_id: site.region_id },
      active_region_id: site.region_id,
      // Preserve the staff.sites join for any code that already uses it,
      // but for HQ also expose the active site under the same field so
      // existing UI (e.g. header) shows the picked site.
      sites: match.sites || { name: site.name, address: site.address },
    }

    localStorage.setItem('gympods_staff', JSON.stringify(session))
    setStaff(session)
    return { success: true, staff: session }
  }

  /**
   * Switch the active site for an HQ user or Region Manager without re-login.
   */
  const switchSite = async (siteId) => {
    if (!staff) return { success: false, error: 'Not logged in' }
    if (staff.role !== 'hq' && staff.role !== 'region_manager') {
      return { success: false, error: 'Cannot switch sites at your access level' }
    }

    const { data: site, error } = await supabase
      .from('sites')
      .select('id, name, address, region_id, regions(name)')
      .eq('id', siteId)
      .single()

    if (error || !site) return { success: false, error: 'Site not found' }

    if (staff.role === 'region_manager' && site.region_id !== staff.region_id) {
      return { success: false, error: 'Site is outside your region' }
    }

    const session = {
      ...staff,
      active_site_id:   site.id,
      active_site:      { id: site.id, name: site.name, address: site.address, region_id: site.region_id },
      active_region_id: site.region_id,
      sites:            { name: site.name, address: site.address },
    }
    localStorage.setItem('gympods_staff', JSON.stringify(session))
    setStaff(session)
    return { success: true }
  }

  const logout = () => {
    setStaff(null)
    localStorage.removeItem('gympods_staff')
  }

  // Role helpers
  // NOTE: isAdmin returns true for admin, region_manager, AND hq —
  // so all three see the manager view in App.jsx.
  const isAdmin         = () => staff && (staff.role === 'admin' || staff.role === 'region_manager' || staff.role === 'hq')
  const isHQ            = () => staff && staff.role === 'hq'
  const isRegionManager = () => staff && (staff.role === 'region_manager' || staff.role === 'hq')
  const isSenior        = () => staff && (staff.role === 'senior_foh' || isAdmin())

  return (
    <AuthContext.Provider value={{
      staff,
      loading,
      loginWithPin,
      switchSite,
      logout,
      isAdmin,
      isHQ,
      isRegionManager,
      isSenior,
      hasMinRole: (r) => hasMinRole(staff?.role, r),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
