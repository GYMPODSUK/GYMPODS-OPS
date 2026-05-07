import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const ROLES = [
  { value: 'foh',        label: 'FOH Staff' },
  { value: 'senior_foh', label: 'Senior FOH' },
  { value: 'admin',      label: 'Admin / Manager' },
  { value: 'hq',         label: 'HQ Access' },
]
const ROLE_LABELS = { foh: 'FOH', senior_foh: 'Sr. FOH', admin: 'Admin', hq: 'HQ' }

export default function StaffManagement() {
  const { staff: currentStaff, isHQ } = useAuth()
  const [staffBySite, setStaffBySite] = useState([]) // array of { site, staff[] }
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', pin: '', role: 'foh', site_id: '', active: true })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    let q = supabase.from('staff').select('*, sites(name)').eq('active', true).order('first_name')
    if (!isHQ()) q = q.eq('site_id', currentStaff.site_id)
    const { data } = await q

    if (isHQ()) {
      const { data: siteData } = await supabase.from('sites').select('*').eq('active', true).order('name')
      setSites(siteData || [])
      // Group by site
      const grouped = (siteData || []).map(site => ({
        site,
        staff: (data || []).filter(s => s.site_id === site.id)
      }))
      setStaffBySite(grouped)
    } else {
      setStaffBySite([{
        site: { id: currentStaff.site_id, name: currentStaff.sites?.name },
        staff: data || []
      }])
    }
    setLoading(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ first_name: '', last_name: '', pin: '', role: 'foh', site_id: currentStaff.site_id, active: true })
    setShowForm(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ first_name: s.first_name, last_name: s.last_name, pin: s.pin, role: s.role, site_id: s.site_id, active: s.active })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.first_name.trim()) { showToast('First name required', 'error'); return }
    if (!/^\d{4}$/.test(form.pin)) { showToast('PIN must be exactly 4 digits', 'error'); return }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('staff').update(form).eq('id', editing.id)
        if (error) throw error
        showToast('Staff member updated')
      } else {
        const { error } = await supabase.from('staff').insert({ ...form, site_id: form.site_id || currentStaff.site_id })
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
    await supabase.from('staff').update({ active: !s.active }).eq('id', s.id)
    showToast(s.active ? 'Staff deactivated' : 'Staff activated')
    loadData()
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
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{totalStaff} active members</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ width: 'auto' }}>+ Add</button>
          </div>
        </div>

        {/* Scrollable list grouped by site */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          {staffBySite.map(group => (
            <div key={group.site.id} style={{ marginBottom: 20 }}>
              {isHQ() && (
                <div style={{
                  fontSize: 12, fontWeight: 800, color: 'var(--navy)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  padding: '8px 0 8px',
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
                  No active staff at this site
                </div>
              ) : (
                group.staff.map(s => (
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
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.first_name} {s.last_name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={`badge ${s.role === 'hq' ? 'role-hq' : s.role === 'admin' ? 'role-admin' : 'role-foh'}`}>
                          {ROLE_LABELS[s.role]}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 500 }}>PIN: {s.pin}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}
                        style={{ padding: '5px 10px', fontSize: 12 }}>Edit</button>
                      <button onClick={() => toggleActive(s)} style={{
                        padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none',
                        borderRadius: 'var(--radius-sm)'
                      }}>Off</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-sheet">
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
              <label className="form-label">4-Digit PIN</label>
              <input className="form-input" placeholder="e.g. 1234" value={form.pin}
                maxLength={4} type="tel" inputMode="numeric"
                onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {isHQ() && (
              <div className="form-group">
                <label className="form-label">Site</label>
                <select className="form-select" value={form.site_id}
                  onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}>
                  <option value="">Select site…</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
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

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
