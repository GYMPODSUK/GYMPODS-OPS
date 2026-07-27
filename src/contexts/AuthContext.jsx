import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hasMinRole } from '../lib/permissions'

const AuthContext = createContext(null)

// Roles that must be physically on-site to log in (below manager).
const FLOOR_ROLES = ['senior_foh', 'foh', 'cleaner', 'trainee']

// Distance between two lat/long points, in metres (haversine).
function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
  const loginWithPin = async (pin, siteId, opts = {}) => {
    // opts: { coords: {latitude, longitude}, override: bool }
    // 1. Resolve site so we know its region + geofence
    const { data: site, error: siteErr } = await supabase
      .from('sites')
      .select('id, name, address, region_id, latitude, longitude, geofence_radius, regions(name)')
      .eq('id', siteId)
      .single()

    if (siteErr || !site) {
      return { success: false, error: 'Site not found' }
    }

    // 2. Find active staff matching this PIN
    const { data: matches, error: staffErr } = await supabase
      .from('staff')
      .select('*, sites!staff_site_id_fkey(name, address)')
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

    // 3b. Location gate — floor staff must be at the site (managers exempt).
    //     Skipped entirely if a manager has authorised via override, or if
    //     the site has no coordinates set (so no one gets locked out).
    if (FLOOR_ROLES.includes(match.role) && !opts.override) {
      const hasGeo = site.latitude != null && site.longitude != null
      if (hasGeo) {
        if (!opts.coords) {
          return { success: false, needsLocation: true }
        }
        const dist = distanceMetres(
          opts.coords.latitude, opts.coords.longitude,
          Number(site.latitude), Number(site.longitude),
        )
        const radius = site.geofence_radius || 200
        if (dist > radius) {
          return { success: false, offSite: true, distance: Math.round(dist) }
        }
      }
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

  /**
   * Verify that a PIN belongs to a manager-or-above with access to this site.
   * Used to authorise an off-site floor-staff login (location override).
   */
  const verifyManagerPin = async (pin, siteId) => {
    const { data: site } = await supabase
      .from('sites').select('id, region_id').eq('id', siteId).single()
    const { data: matches } = await supabase
      .from('staff').select('id, role, site_id, region_id').eq('pin', pin).eq('active', true)
    if (!matches || matches.length === 0) return false
    return matches.some(m =>
      m.role === 'hq' ||
      (m.role === 'region_manager' && m.region_id === site?.region_id) ||
      (m.role === 'admin' && m.site_id === siteId)
    )
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
      verifyManagerPin,
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
