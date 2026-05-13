import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES, fullName } from '../../lib/permissions'

export default function Sites() {
  const { staff } = useAuth()
  const isHQ = staff?.role === ROLES.HQ

  const [sites, setSites] = useState([])
  const [regions, setRegions] = useState([])
  const [adminStaff, setAdminStaff] = useState([])      // staff with role='admin' (Site Managers)
  const [regionMgrStaff, setRegionMgrStaff] = useState([]) // staff with role='region_manager'
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showRegions, setShowRegions] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [form, setForm] = useState({
    name: '', address: '', latitude: '', longitude: '',
    geofence_radius: '200', active: true,
    region_id: '', primary_admin_id: '',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [s, r, a, rm] = await Promise.all([
      supabase.from('sites').select('*, regions(name), primary_admin:primary_admin_id(first_name, last_name)').order('name'),
      supabase.from('regions').select('*, manager:manager_id(first_name, last_name)').order('name'),
      supabase.from('staff').select('id, first_name, last_name, site_id, active').eq('role', 'admin').eq('active', true),
      supabase.from('staff').select('id, first_name, last_name, region_id, active').eq('role', 'region_manager').eq('active', true),
    ])
    setSites(s.data || [])
    setRegions(r.data || [])
    setAdminStaff(a.data || [])
    setRegionMgrStaff(rm.data || [])
    setLoading(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      name: '', address: '', latitude: '', longitude: '',
      geofence_radius: '200', active: true,
      region_id: '', primary_admin_id: '',
    })
    setShowForm(true)
  }

  const openEdit = (site) => {
    setEditing(site)
    setForm({
      name: site.name,
      address: site.address || '',
      latitude: site.latitude || '',
      longitude: site.longitude || '',
      geofence_radius: site.geofence_radius || '200',
      active: site.active,
      region_id: site.region_id || '',
      primary_admin_id: site.primary_admin_id || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Site name required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        geofence_radius: form.geofence_radius ? parseInt(form.geofence_radius) : 200,
        active: form.active,
        region_id: form.region_id || null,
        primary_admin_id: form.primary_admin_id || null,
      }
      if (editing) {
        await supabase.from('sites').update(payload).eq('id', editing.id)
        showToast('Site updated')
      } else {
        await supabase.from('sites').insert(payload)
        showToast('Site added')
      }
      setShowForm(false)
      loadData()
    } catch (err) {
      showToast('Error saving', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (site) => {
    await supabase.from('sites').update({ active: !site.active }).eq('id', site.id)
    showToast(site.active ? 'Site deactivated' : 'Site activated')
    loadData()
  }

  const getMapLink = (site) => {
    if (site.latitude && site.longitude) {
      return `https://www.google.com/maps?q=${site.latitude},${site.longitude}`
    }
    if (site.address) {
      return `https://www.google.com/maps/search/${encodeURIComponent(site.address)}`
    }
    return null
  }

  // Site Managers eligible to be the main manager for the site being edited.
  // Show staff with role='admin' who are either already at this site, or unassigned.
  const eligibleSiteManagers = adminStaff.filter(a =>
    !editing || !a.site_id || a.site_id === editing.id
  )

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  // Group sites by region (matches Network Overview convention)
  const sitesByRegion = regions.map(r => ({
    ...r, sites: sites.filter(s => s.region_id === r.id),
  }))
  const unassigned = sites.filter(s => !s.region_id)

  return (
    <>
      <div style={{
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        flexShrink: 0, padding: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>Sites</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              HQ access only · {sites.length} {sites.length === 1 ? 'site' : 'sites'} across {regions.length} regions
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {isHQ && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowRegions(true)}
                style={{ width: 'auto' }}
              >
                Manage regions
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ width: 'auto' }}>
              + Add site
            </button>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0
      }}>
        {sitesByRegion.filter(r => r.sites.length > 0).map(region => (
          <div key={region.id}>
            <div style={{
              fontSize: 12, fontWeight: 800, color: 'var(--navy)',
              textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8,
              display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
            }}>
              {region.name}
              <span style={{ fontSize: 10, color: 'var(--text-light)', fontWeight: 600 }}>
                {region.sites.length} {region.sites.length === 1 ? 'site' : 'sites'}
              </span>
              {region.manager && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  · Region Mgr: {region.manager.first_name} {region.manager.last_name}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {region.sites.map(site => (
                <SiteRow key={site.id} site={site} onEdit={openEdit} onToggle={toggleActive} mapLink={getMapLink(site)} />
              ))}
            </div>
          </div>
        ))}

        {unassigned.length > 0 && (
          <div>
            <div style={{
              fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8,
            }}>
              Unassigned · {unassigned.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unassigned.map(site => (
                <SiteRow key={site.id} site={site} onEdit={openEdit} onToggle={toggleActive} mapLink={getMapLink(site)} />
              ))}
            </div>
          </div>
        )}

        {sites.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📍</div>
            <div className="empty-state-text">No sites yet. Tap "+ Add site" to add your first.</div>
          </div>
        )}
      </div>

      {/* Add / Edit site modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <div className="modal-title">{editing ? 'Edit Site' : 'Add Site'}</div>

            <div className="form-group">
              <label className="form-label">Site name</label>
              <input className="form-input" placeholder="e.g. GYMPODS Manchester"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" placeholder="Full address"
                value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>

            {/* Region picker */}
            <div className="form-group">
              <label className="form-label">Region</label>
              <select className="form-select" value={form.region_id}
                onChange={e => setForm(f => ({ ...f, region_id: e.target.value }))}>
                <option value="">— Unassigned —</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            {/* Main manager picker */}
            <div className="form-group">
              <label className="form-label">Main Manager (Site Manager)</label>
              <select className="form-select" value={form.primary_admin_id}
                onChange={e => setForm(f => ({ ...f, primary_admin_id: e.target.value }))}>
                <option value="">— None set —</option>
                {eligibleSiteManagers.map(a => (
                  <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                Only staff with Site Manager role appear here. Assign in Staff Management first.
              </div>
            </div>

            {/* Coordinates */}
            <div style={{
              background: 'var(--aqua-light)', borderRadius: 'var(--radius-md)',
              padding: '12px 14px', marginBottom: 14
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
                GEOLOCATION COORDINATES
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.4 }}>
                Right-click on the exact location in Google Maps and copy the coordinates.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Latitude</label>
                  <input className="form-input" placeholder="e.g. 51.5463" type="number" step="0.0001"
                    value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Longitude</label>
                  <input className="form-input" placeholder="e.g. -0.0756" type="number" step="0.0001"
                    value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Geofence radius (metres)</label>
              <input className="form-input" type="number" placeholder="200"
                value={form.geofence_radius}
                onChange={e => setForm(f => ({ ...f, geofence_radius: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Site'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage regions modal */}
      {showRegions && (
        <RegionsModal
          regions={regions}
          sites={sites}
          regionMgrStaff={regionMgrStaff}
          onClose={() => setShowRegions(false)}
          onChanged={() => loadData()}
          showToast={showToast}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

function SiteRow({ site, onEdit, onToggle, mapLink }) {
  const hasCoords = site.latitude && site.longitude
  return (
    <div style={{
      background: 'var(--white)', border: `1px solid ${site.active ? 'var(--border)' : 'rgba(0,0,0,0.06)'}`,
      borderRadius: 'var(--radius-lg)', padding: '16px', opacity: site.active ? 1 : 0.5
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>{site.name}</div>
          {site.address && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{site.address}</div>
          )}

          {/* Region + Main Manager line */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {site.regions?.name && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: 'var(--aqua-light)', color: 'var(--navy)',
              }}>
                📍 {site.regions.name}
              </span>
            )}
            {site.primary_admin && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: 'var(--off-white)', color: 'var(--text-secondary)',
              }}>
                👤 {site.primary_admin.first_name} {site.primary_admin.last_name}
              </span>
            )}
          </div>

          {/* Geolocation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: hasCoords ? 'var(--success)' : 'var(--warning)'
            }} />
            <span style={{ fontSize: 12, color: hasCoords ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
              {hasCoords
                ? `Geolocation set · ${site.geofence_radius || 200}m radius`
                : 'No coordinates — geolocation inactive'}
            </span>
            {hasCoords && mapLink && (
              <a href={mapLink} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: 'var(--aqua)', textDecoration: 'none', fontWeight: 600 }}>
                View map ›
              </a>
            )}
          </div>
        </div>

        <span className={`badge ${site.active ? 'badge-completed' : 'badge-pending'}`}>
          {site.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-outline btn-sm" onClick={() => onEdit(site)} style={{ flex: 1 }}>
          Edit
        </button>
        <button
          className="btn btn-sm"
          onClick={() => onToggle(site)}
          style={{
            flex: 1, background: site.active ? 'var(--danger-bg)' : 'var(--success-bg)',
            color: site.active ? 'var(--danger)' : 'var(--success)', border: 'none'
          }}
        >
          {site.active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  )
}

// ─── Manage Regions modal ──────────────────────────────────────────
function RegionsModal({ regions, sites, regionMgrStaff, onClose, onChanged, showToast }) {
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)

  const siteCount = (regionId) => sites.filter(s => s.region_id === regionId).length

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    const { error } = await supabase.from('regions').insert({ name })
    setBusy(false)
    if (error) { showToast(error.message?.includes('duplicate') ? 'Region already exists' : 'Error', 'error'); return }
    setNewName('')
    showToast('Region added')
    onChanged()
  }

  const startRename = (r) => {
    setRenamingId(r.id)
    setRenameValue(r.name)
  }

  const saveRename = async (r) => {
    const name = renameValue.trim()
    if (!name) { setRenamingId(null); return }
    if (name === r.name) { setRenamingId(null); return }
    setBusy(true)
    const { error } = await supabase.from('regions').update({ name }).eq('id', r.id)
    setBusy(false)
    if (error) { showToast('Error', 'error'); return }
    setRenamingId(null)
    showToast('Region renamed')
    onChanged()
  }

  const handleDelete = async (r) => {
    if (siteCount(r.id) > 0) {
      showToast(`Can't delete — ${siteCount(r.id)} site(s) still assigned`, 'error')
      return
    }
    if (!window.confirm(`Delete region "${r.name}"?`)) return
    setBusy(true)
    const { error } = await supabase.from('regions').delete().eq('id', r.id)
    setBusy(false)
    if (error) { showToast('Error', 'error'); return }
    showToast('Region deleted')
    onChanged()
  }

  const handleAssignManager = async (regionId, staffId) => {
    setBusy(true)
    await supabase.from('regions').update({ manager_id: staffId || null }).eq('id', regionId)
    // Also keep the staff record's region_id in sync so their access rights line up
    if (staffId) {
      await supabase.from('staff').update({ region_id: regionId }).eq('id', staffId)
    }
    setBusy(false)
    showToast(staffId ? 'Region Manager assigned' : 'Region Manager cleared')
    onChanged()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <div className="modal-title">Manage Regions</div>

        {/* Add region */}
        <div className="form-group">
          <label className="form-label">Add new region</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" placeholder="e.g. Edinburgh"
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={busy || !newName.trim()} style={{ width: 'auto' }}>
              Add
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0', paddingTop: 8 }}>
          <div className="section-heading" style={{ marginTop: 0 }}>Existing regions</div>
          {regions.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: 12 }}>No regions yet.</div>
          )}
          {regions.map(r => {
            const count = siteCount(r.id)
            const isRenaming = renamingId === r.id
            return (
              <div key={r.id} style={{
                background: 'var(--off-white)', borderRadius: 'var(--radius-md)',
                padding: '12px 14px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {isRenaming ? (
                    <>
                      <input className="form-input" value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveRename(r)}
                        style={{ flex: 1, marginBottom: 0 }} autoFocus />
                      <button className="btn btn-primary btn-sm" onClick={() => saveRename(r)} disabled={busy} style={{ width: 'auto' }}>Save</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setRenamingId(null)} style={{ width: 'auto' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                          {count} {count === 1 ? 'site' : 'sites'}
                        </div>
                      </div>
                      <button onClick={() => startRename(r)} className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '4px 10px', fontSize: 11 }}>Rename</button>
                      <button onClick={() => handleDelete(r)} disabled={count > 0}
                        style={{
                          padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: count > 0 ? 'not-allowed' : 'pointer',
                          background: count > 0 ? 'var(--off-white)' : 'var(--danger-bg)',
                          color: count > 0 ? 'var(--text-light)' : 'var(--danger)',
                          border: 'none', borderRadius: 'var(--radius-sm)',
                          opacity: count > 0 ? 0.5 : 1,
                        }}>
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {!isRenaming && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Region Manager
                    </label>
                    <select
                      className="form-select"
                      value={r.manager_id || ''}
                      onChange={e => handleAssignManager(r.id, e.target.value)}
                      disabled={busy}
                      style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}
                    >
                      <option value="">— None assigned —</option>
                      {regionMgrStaff.map(s => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                      ))}
                    </select>
                    {regionMgrStaff.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                        No Region Manager staff exist yet. Create one in Staff Management first.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button className="btn btn-outline" onClick={onClose} style={{ marginTop: 8 }}>Close</button>
      </div>
    </div>
  )
}
