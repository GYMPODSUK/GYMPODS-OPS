import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES, ROLE_LABEL, ROLE_RANK, PIN_LENGTH, canPromoteTo } from '../../lib/permissions'

// Reset-reason options shown in the audit dropdown.
// Must match the CHECK constraint on pin_changes.reason_code.
const RESET_REASONS = [
  { value: 'forgot',   label: 'Forgot PIN' },
  { value: 'left',     label: 'Staff left / dismissed' },
  { value: 'security', label: 'Security concern' },
  { value: 'routine',  label: 'Routine rotation' },
  { value: 'other',    label: 'Other' },
]

export default function StaffManagement() {
  const { staff: currentStaff, isHQ } = useAuth()
  const myRole     = currentStaff?.role
  const myRegionId = currentStaff?.region_id
  const mySiteId   = currentStaff?.active_site_id || currentStaff?.site_id

  const [staffBySite, setStaffBySite] = useState([]) // [{ site, staff[] }]
  const [sites, setSites] = useState([])
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [resetting, setResetting] = useState(null) // staff member whose PIN is being reset

  const [form, setForm] = useState({
    first_name: '', last_name: '', pin: '',
    role: 'foh', site_id: '', region_id: '', active: true,
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)

    // Sites + regions (scoped to user's authority)
    let sitesQ = supabase.from('sites').select('id, name, region_id').eq('active', true).order('name')
    if (myRole === ROLES.REGION_MANAGER) sitesQ = sitesQ.eq('region_id', myRegionId)
    if (myRole === ROLES.ADMIN) sitesQ = sitesQ.eq('id', mySiteId)
    const { data: siteData } = await sitesQ
    setSites(siteData || [])

    const { data: regionData } = await supabase.from('regions').select('id, name').order('name')
    setRegions(regionData || [])

    // Staff — scoped to user's authority
    let staffQ = supabase
      .from('staff')
      .select('*, sites!staff_site_id_fkey(name)')
      .eq('active', true)
      .order('first_name')

    if (myRole === ROLES.REGION_MANAGER) {
      // Region Mgr sees: staff at sites in their region, plus other Region Mgrs in their region
      const regionSiteIds = (siteData || []).map(s => s.id)
      if (regionSiteIds.length > 0) {
        staffQ = staffQ.or(`site_id.in.(${regionSiteIds.join(',')}),and(role.eq.region_manager,region_id.eq.${myRegionId})`)
      } else {
        staffQ = staffQ.eq('region_id', myRegionId)
      }
    } else if (myRole === ROLES.ADMIN) {
      // Site Mgr sees: staff at their site only
      staffQ = staffQ.eq('site_id', mySiteId)
    }
    // HQ sees everyone — no filter

    const { data: staffData } = await staffQ

    // Group by site (HQ + Region Mgr); single group for Site Mgr
    if (isHQ() || myRole === ROLES.REGION_MANAGER) {
      // Special "no site" group for HQ + Region Managers (NULL site_id)
      const orphans = (staffData || []).filter(s => !s.site_id)
      const grouped = (siteData || []).map(site => ({
        site,
        staff: (staffData || []).filter(s => s.site_id === site.id),
      }))
      if (orphans.length > 0) {
        grouped.unshift({
          site: { id: 'no-site', name: 'HQ / Region Managers (no site)' },
          staff: orphans,
        })
      }
      setStaffBySite(grouped)
    } else {
      setStaffBySite([{
        site: { id: mySiteId, name: currentStaff.active_site?.name || 'My site' },
        staff: staffData || [],
      }])
    }

    setLoading(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  // Roles this user is allowed to assign
  const assignableRoles = Object.keys(ROLE_LABEL).filter(r => canPromoteTo(myRole, r))

  // Is the current user allowed to edit / reset this staff member?
  const canActOn = (s) => {
    if (!s || s.id === currentStaff.id) return false  // can't edit yourself here
    if (!canPromoteTo(myRole, s.role)) return false   // target role above our authority
    if (isHQ()) return true
    if (myRole === ROLES.REGION_MANAGER) {
      // Must be in our region (via site or direct region_id)
      const inOurRegion = s.region_id === myRegionId ||
        sites.some(site => site.id === s.site_id)
      return inOurRegion
    }
    if (myRole === ROLES.ADMIN) {
      return s.site_id === mySiteId
    }
    return false
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      first_name: '', last_name: '', pin: '',
      role: assignableRoles[assignableRoles.length - 1] || 'foh',   // default to lowest role
      site_id: myRole === ROLES.ADMIN ? mySiteId : '',
      region_id: myRole === ROLES.REGION_MANAGER ? myRegionId : '',
      active: true,
    })
    setShowForm(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({
      first_name: s.first_name, last_name: s.last_name,
      pin: '', // never preload PIN — Pattern A
      role: s.role,
      site_id: s.site_id || '',
      region_id: s.region_id || '',
      active: s.active,
    })
    setShowForm(true)
  }

  // Required PIN length for the role currently selected in the form
  const requiredPinLen = PIN_LENGTH[form.role] || 4
  const pinValid = new RegExp(`^\\d{${requiredPinLen}}$`).test(form.pin)

  const handleSave = async () => {
    if (!form.first_name.trim()) { showToast('First name required', 'error'); return }

    // Role-aware: ensure user can assign this role
    if (!canPromoteTo(myRole, form.role)) {
      showToast(`You can't assign the ${ROLE_LABEL[form.role]} role`, 'error')
      return
    }

    // Site/region validity per role
    if (form.role === ROLES.HQ) {
      form.site_id = null
      form.region_id = null
    } else if (form.role === ROLES.REGION_MANAGER) {
      if (!form.region_id) { showToast('Region required for Region Manager', 'error'); return }
      form.site_id = null
    } else {
      if (!form.site_id) { showToast('Site required', 'error'); return }
    }

    // PIN validation — only required when creating new staff or explicitly setting one
    if (!editing) {
      if (!pinValid) {
        showToast(`PIN must be exactly ${requiredPinLen} digits for ${ROLE_LABEL[form.role]}`, 'error')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        role:       form.role,
        site_id:    form.site_id || null,
        region_id:  form.region_id || null,
        active:     form.active,
      }
      // Only set pin on insert; edits never overwrite PIN here (Pattern A — use Reset)
      if (!editing) payload.pin = form.pin

      if (editing) {
        const { error } = await supabase.from('staff').update(payload).eq('id', editing.id)
        if (error) throw error
        showToast('Staff member updated')
      } else {
        const { error } = await supabase.from('staff').insert(payload)
        if (error) throw error
        showToast('Staff member added')
      }
      setShowForm(false)
      loadData()
    } catch (err) {
      showToast(err.message || 'Error saving', 'error')
    } finally { setSaving(false) }
  }

  const toggleActive = async (s) => {
    if (!canActOn(s)) { showToast("You can't change this staff member", 'error'); return }
    await supabase.from('staff').update({ active: !s.active }).eq('id', s.id)
    showToast(s.active ? 'Staff deactivated' : 'Staff activated')
    loadData()
  }

  // ── PIN reset flow ────────────────────────────────────────────
  const handlePinReset = async (newPin, reasonCode, reasonNote) => {
    if (!resetting) return
    const targetLen = PIN_LENGTH[resetting.role] || 4
    if (!new RegExp(`^\\d{${targetLen}}$`).test(newPin)) {
      return { error: `PIN must be exactly ${targetLen} digits for ${ROLE_LABEL[resetting.role]}` }
    }
    if (!reasonCode) {
      return { error: 'Please pick a reason' }
    }

    const { error: updateErr } = await supabase.from('staff').update({ pin: newPin }).eq('id', resetting.id)
    if (updateErr) return { error: updateErr.message }

    // Write to audit log — silent failure won't block the reset itself
    await supabase.from('pin_changes').insert({
      staff_id:    resetting.id,
      changed_by:  currentStaff.id,
      reason_code: reasonCode,
      reason_note: reasonNote || null,
    })

    showToast('PIN reset ✓')
    setResetting(null)
    return { ok: true }
  }

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>

  const totalStaff = staffBySite.reduce((sum, g) => sum + g.staff.length, 0)

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Fixed header */}
        <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '14px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>Staff</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                {totalStaff} active members
                {assignableRoles.length === 0 && ' · view only'}
              </div>
            </div>
            {assignableRoles.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ width: 'auto' }}>+ Add</button>
            )}
          </div>
        </div>

        {/* Scrollable list grouped by site */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          {staffBySite.map(group => (
            <div key={group.site.id} style={{ marginBottom: 20 }}>
              {(isHQ() || myRole === ROLES.REGION_MANAGER) && (
                <div style={{
                  fontSize: 12, fontWeight: 800, color: 'var(--navy)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  padding: '8px 0',
                  borderBottom: '2px solid var(--aqua)',
                  marginBottom: 10
                }}>
                  {group.site.name}
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                    · {group.staff.length} staff
                  </span>
                </div>
              )}

              {group.staff.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-light)', padding: '8px 0', fontStyle: 'italic' }}>
                  No active staff
                </div>
              ) : (
                group.staff.map(s => {
                  const canTouch = canActOn(s)
                  return (
                    <div key={s.id} style={{
                      background: 'var(--white)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: 'var(--aqua-light)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 800, fontSize: 15,
                        color: 'var(--aqua-dark)', flexShrink: 0
                      }}>
                        {s.first_name[0]}{s.last_name?.[0] || ''}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {s.first_name} {s.last_name}
                          {s.id === currentStaff.id && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-light)', fontWeight: 500 }}>(you)</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span className={`badge ${s.role === 'hq' ? 'role-hq' : (s.role === 'admin' || s.role === 'region_manager') ? 'role-admin' : 'role-foh'}`}>
                            {ROLE_LABEL[s.role] || s.role}
                          </span>
                          {/* PIN never displayed — Pattern A */}
                          <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 500 }}>
                            🔒 PIN set
                          </span>
                        </div>
                      </div>
                      {canTouch && (
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}
                            style={{ padding: '5px 10px', fontSize: 11 }}>Edit</button>
                          <button onClick={() => setResetting(s)} style={{
                            padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: 'var(--warning-bg)', color: 'var(--warning)', border: 'none',
                            borderRadius: 'var(--radius-sm)'
                          }}>Reset PIN</button>
                          <button onClick={() => toggleActive(s)} style={{
                            padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none',
                            borderRadius: 'var(--radius-sm)'
                          }}>Off</button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <div className="modal-title">{editing ? 'Edit Staff Member' : 'Add Staff Member'}</div>

            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" placeholder="First name" value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" placeholder="Last name" value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                disabled={editing && !canPromoteTo(myRole, form.role)}>
                {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                PIN length for {ROLE_LABEL[form.role]}: {requiredPinLen} digits
              </div>
            </div>

            {/* Site / Region pickers — depend on role */}
            {form.role !== ROLES.HQ && form.role !== ROLES.REGION_MANAGER && (
              <div className="form-group">
                <label className="form-label">Site</label>
                <select className="form-select" value={form.site_id}
                  onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}>
                  <option value="">Select site…</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {form.role === ROLES.REGION_MANAGER && (
              <div className="form-group">
                <label className="form-label">Region</label>
                <select className="form-select" value={form.region_id}
                  onChange={e => setForm(f => ({ ...f, region_id: e.target.value }))}>
                  <option value="">Select region…</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}

            {/* PIN — only on creation; resets happen via Reset PIN flow */}
            {!editing && (
              <div className="form-group">
                <label className="form-label">{requiredPinLen}-digit PIN</label>
                <input className="form-input"
                  placeholder={'•'.repeat(requiredPinLen)}
                  value={form.pin}
                  maxLength={requiredPinLen}
                  type="tel" inputMode="numeric"
                  onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, requiredPinLen) }))} />
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                  Once set, this PIN cannot be viewed — only reset.
                </div>
              </div>
            )}
            {editing && (
              <div style={{
                background: 'var(--off-white)', padding: '10px 12px',
                borderRadius: 'var(--radius-sm)', marginBottom: 14,
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4,
              }}>
                🔒 To change this staff member's PIN, close this dialog and click <strong>Reset PIN</strong> on their card.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Staff Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN reset modal */}
      {resetting && (
        <ResetPinModal
          staff={resetting}
          onClose={() => setResetting(null)}
          onReset={handlePinReset}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

function ResetPinModal({ staff, onClose, onReset }) {
  const targetLen = PIN_LENGTH[staff.role] || 4
  const [pin, setPin] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const pinValid = new RegExp(`^\\d{${targetLen}}$`).test(pin)

  const handle = async () => {
    setError('')
    if (!pinValid) { setError(`PIN must be exactly ${targetLen} digits`); return }
    if (!reasonCode) { setError('Please pick a reason'); return }
    setBusy(true)
    const res = await onReset(pin, reasonCode, reasonNote)
    setBusy(false)
    if (res?.error) setError(res.error)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-title">Reset PIN</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.4 }}>
          Resetting PIN for <strong>{staff.first_name} {staff.last_name}</strong> ({ROLE_LABEL[staff.role]}).
          The new PIN replaces the old one — there's no way to recover the previous one.
        </div>

        <div className="form-group">
          <label className="form-label">New {targetLen}-digit PIN</label>
          <input className="form-input"
            placeholder={'•'.repeat(targetLen)}
            value={pin}
            maxLength={targetLen}
            type="tel" inputMode="numeric"
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, targetLen))} />
        </div>

        <div className="form-group">
          <label className="form-label">Reason</label>
          <select className="form-select" value={reasonCode}
            onChange={e => setReasonCode(e.target.value)}>
            <option value="">Choose reason…</option>
            {RESET_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {reasonCode === 'other' && (
          <div className="form-group">
            <label className="form-label">Note</label>
            <input className="form-input" placeholder="Brief note (optional)"
              value={reasonNote}
              onChange={e => setReasonNote(e.target.value)} />
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handle} disabled={busy} style={{ flex: 2 }}>
            {busy ? 'Resetting…' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  )
}
