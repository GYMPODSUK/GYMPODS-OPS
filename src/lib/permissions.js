// src/lib/permissions.js
// Single source of truth for the role hierarchy.

export const ROLES = {
  HQ:             'hq',
  REGION_MANAGER: 'region_manager',
  ADMIN:          'admin',
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
  admin:          'Manager',
  senior_foh:     'Sr. FOH',
  foh:            'FOH',
  cleaner:        'Cleaner',
  trainee:        'Trainee',
}

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
