import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function Sites() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    name: '', address: '', latitude: '', longitude: '',
    geofence_radius: '200', active: true
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase.from('sites').select('*').order('name')
    setSites(data || [])
    setLoading(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', address: '', latitude: '', longitude: '', geofence_radius: '200', active: true })
    setShowForm(true)
  }

  const openEdit = (site) => {
    setEditing(site)
    setForm({
      name: site.name, address: site.address || '',
      latitude: site.latitude || '', longitude: site.longitude || '',
      geofence_radius: site.geofence_radius || '200',
      active: site.active
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

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <>
      <div style={{
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        flexShrink: 0, padding: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>Sites</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              HQ access only · {sites.length} sites
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ width: 'auto' }}>
            + Add site
          </button>
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0
      }}>
        {sites.map(site => {
          const mapLink = getMapLink(site)
          const hasCoords = site.latitude && site.longitude
          return (
            <div key={site.id} style={{
              background: 'var(--white)', border: `1px solid ${site.active ? 'var(--border)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 'var(--radius-lg)', padding: '16px', opacity: site.active ? 1 : 0.5
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>{site.name}</div>
                  {site.address && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{site.address}</div>
                  )}

                  {/* Geolocation status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: hasCoords ? 'var(--success)' : 'var(--warning)'
                    }} />
                    <span style={{ fontSize: 12, color: hasCoords ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                      {hasCoords
                        ? `Geolocation set · ${site.geofence_radius || 200}m radius`
                        : 'No coordinates — geolocation inactive'
                      }
                    </span>
                    {hasCoords && mapLink && (
                      <a href={mapLink} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: 'var(--aqua)', textDecoration: 'none', fontWeight: 600 }}>
                        View map ›
                      </a>
                    )}
                  </div>

                  {hasCoords && (
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>
                      {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                    </div>
                  )}
                </div>

                <span className={`badge ${site.active ? 'badge-completed' : 'badge-pending'}`}>
                  {site.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn btn-outline btn-sm" onClick={() => openEdit(site)} style={{ flex: 1 }}>
                  Edit
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => toggleActive(site)}
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
        })}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-sheet" style={{ maxHeight: '90vh' }}>
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

            {/* Coordinates */}
            <div style={{
              background: 'var(--aqua-light)', borderRadius: 'var(--radius-md)',
              padding: '12px 14px', marginBottom: 14
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
                GEOLOCATION COORDINATES
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.4 }}>
                Get coordinates from Google Maps — right-click on the exact site location and copy the numbers shown.
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

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
