// src/lib/permissions.js
// Single source of truth for the role hierarchy and access checks.

export const ROLES = {
  HQ:             'hq',
  REGION_MANAGER: 'region_manager',
  ADMIN:          'admin',           // displayed as "Site Manager" in UI
  SENIOR_FOH:     'senior_foh',
  FOH:            'foh',
  CLEANER:        'cleaner',
  TRAINEE:        'trainee',
}

export const ROLE_RANK = {
  hq:             100,
  region_manager:  80,
  admin:           60,
  senior_foh:      40,
  foh:             30,
  cleaner:         20,
  trainee:         10,
}

export const ROLE_LABEL = {
  hq:             'HQ',
  region_manager: 'Region Mgr',
  admin:          'Site Manager',
  senior_foh:     'Sr. FOH',
  foh:            'FOH',
  cleaner:        'Cleaner',
  trainee:        'Trainee',
}

// PIN length policy by role.
// 8 = HQ, 6 = Region/Site Manager, 4 = team (default)
export const PIN_LENGTH = {
  hq:             8,
  region_manager: 6,
  admin:          6,
  senior_foh:     4,
  foh:            4,
  cleaner:        4,
  trainee:        4,
}

// Valid PIN lengths the login screen will accept
export const VALID_PIN_LENGTHS = [4, 6, 8]

export function hasMinRole(role, minRole) {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[minRole] ?? 0)
}

/**
 * Can this staff member access this site?
 *   - HQ: any site
 *   - Region Manager: sites in their region
 *   - Everyone else: their assigned site only
 */
export function canAccessSite(staff, siteId, siteRegionId) {
  if (!staff) return false
  if (staff.role === ROLES.HQ) return true
  if (staff.role === ROLES.REGION_MANAGER) return staff.region_id === siteRegionId
  return staff.site_id === siteId
}

// ─── Region management ─────────────────────────────────────────────
// Only HQ touches the structural layer (regions themselves).
export function canManageRegions(staff) {
  return staff?.role === ROLES.HQ
}

// HQ creates/deletes sites; Region Mgr can edit sites in their region
// (e.g. set the Main Manager) but not add new ones.
export function canCreateSites(staff) {
  return staff?.role === ROLES.HQ
}

export function canEditSite(staff, site) {
  if (!staff || !site) return false
  if (staff.role === ROLES.HQ) return true
  if (staff.role === ROLES.REGION_MANAGER) return site.region_id === staff.region_id
  return false
}

// ─── Staff promotion authority ─────────────────────────────────────
// HQ → any role
// Region Mgr → up to Site Manager, within their region
// Site Manager → up to Senior FOH, within their site
// Anyone below → no promotion rights
export function canPromoteTo(currentRole, targetRole) {
  if (currentRole === ROLES.HQ) return true

  if (currentRole === ROLES.REGION_MANAGER) {
    // Can promote up to admin (Site Manager) but no higher
    return ROLE_RANK[targetRole] <= ROLE_RANK[ROLES.ADMIN]
  }

  if (currentRole === ROLES.ADMIN) {
    // Can promote up to senior_foh but no higher
    return ROLE_RANK[targetRole] <= ROLE_RANK[ROLES.SENIOR_FOH]
  }

  return false
}

/** Helper to display a staff member's full name from first/last. */
export function fullName(staff) {
  if (!staff) return ''
  return `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
}
