// src/pages/registers/Register.jsx
// Shared, config-driven register. Renders any register defined in
// src/lib/registers.js — list, filters, add form, detail view, realtime
// sync and photo upload. Mirrors the Issues + ComposeMessage patterns.
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SEVERITY_OPTIONS } from '../../lib/registers'

const STORAGE_BUCKET = 'record-images'

// ── datetime-local helpers ─────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const nowLocalInput = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const toISO = (localValue) => (localValue ? new Date(localValue).toISOString() : null)

export default function Register({ config, onBack, embedded = false, onChanged }) {
  const { staff, isHQ } = useAuth()
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState(config.statuses[0].value)
  const [selected, setSelected] = useState(null)
  const [detailImages, setDetailImages] = useState([])
  const [showAdd, setShowAdd]   = useState(false)
  const [busy, setBusy]         = useState(false)
  const [toast, setToast]       = useState(null)

  // Collect-prompt state (e.g. Lost & Found "Collected by")
  const [collectValue, setCollectValue] = useState('')
  const [collectingStatus, setCollectingStatus] = useState(null)

  const scopedSiteId = staff.active_site_id || staff.site_id

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  // ── data load ─────────────────────────────────────────────────────
  const loadRecords = async () => {
    setLoading(true)
    // Explicit FK aliases avoid the staff/sites multi-FK embedding gotcha.
    let select = '*, logged:logged_by ( first_name, last_name ), sites:site_id ( name ), actioner:updated_by ( first_name, last_name )'
    if (config.resolveStatus) select += ', resolver:resolved_by ( first_name, last_name )'

    let q = supabase.from(config.table).select(select).order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    if (!isHQ()) q = q.eq('site_id', scopedSiteId)

    const { data, error } = await q
    if (error) console.error(`${config.table} query error:`, error)
    setRecords(data || [])
    setLoading(false)
  }

  useEffect(() => { loadRecords() }, [filter, config.table])

  // ── realtime sync (same approach as Issues) ───────────────────────
  useEffect(() => {
    if (!scopedSiteId && !isHQ()) return
    const filterClause = isHQ() ? undefined : `site_id=eq.${scopedSiteId}`
    const channel = supabase
      .channel(`${config.table}-sync-${scopedSiteId || 'hq'}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: config.table, ...(filterClause ? { filter: filterClause } : {}) },
        () => loadRecords())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedSiteId, filter, config.table])

  const openRecord = async (rec) => {
    setSelected(rec)
    setCollectingStatus(null)
    setCollectValue('')
    setDetailImages([])
    if (config.hasImages) {
      const { data } = await supabase
        .from('record_images').select('*')
        .eq('record_type', config.recordType).eq('record_id', rec.id)
      setDetailImages(data || [])
    }
  }

  // ── status transitions ────────────────────────────────────────────
  const applyStatus = async (newStatus, extra = {}) => {
    setBusy(true)
    const now = new Date().toISOString()
    // Every status change stamps who did it and when (the "who did and when" log).
    const update = { status: newStatus, updated_by: staff.id, updated_at: now, ...extra }
    if (config.resolveStatus && newStatus === config.resolveStatus) {
      update.resolved_by = staff.id
      update.resolved_at = now
    }
    const { error } = await supabase.from(config.table).update(update).eq('id', selected.id)
    if (!error) {
      const me = { first_name: staff.first_name, last_name: staff.last_name }
      setSelected(prev => ({ ...prev, ...update, actioner: me, ...(update.resolved_by ? { resolver: me } : {}) }))
      setCollectingStatus(null)
      setCollectValue('')
      showToast('Updated ✓')
      onChanged?.()
    } else {
      console.error(error); showToast('Update failed', 'error')
    }
    setBusy(false)
  }

  const handleStatusClick = (statusValue) => {
    const p = config.promptOnStatus
    if (p && p.status === statusValue) {
      setCollectingStatus(statusValue)   // show inline prompt instead of updating now
      return
    }
    applyStatus(statusValue)
  }

  const confirmCollect = () => {
    const p = config.promptOnStatus
    const extra = { [p.field]: collectValue.trim() || null }
    if (p.timestampField) extra[p.timestampField] = new Date().toISOString()
    applyStatus(collectingStatus, extra)
  }

  // ── formatting ────────────────────────────────────────────────────
  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }
  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const statusMeta   = (v) => config.statuses.find(s => s.value === v) || { label: v, color: 'var(--text-light)', bg: 'var(--off-white)' }
  const severityMeta = (v) => SEVERITY_OPTIONS.find(s => s.value === v)

  const filters = [...config.statuses, { value: 'all', label: 'All' }]

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '14px 16px 0', flexShrink: 0 }}>
          {!embedded && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {onBack && (
                <button className="btn-icon" onClick={onBack} aria-label="Back" style={{ fontSize: 22, lineHeight: 1 }}>‹</button>
              )}
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)', flex: 1 }}>
                {config.icon} {config.label}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
              {filters.map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                  background: filter === f.value ? 'var(--navy)' : 'var(--off-white)',
                  color: filter === f.value ? 'var(--white)' : 'var(--text-secondary)',
                  border: `1px solid ${filter === f.value ? 'var(--navy)' : 'var(--border)'}`,
                }}>{f.label}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => setShowAdd(true)}>+ New</button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><div className="spinner" /></div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{config.icon}</div>
              <div className="empty-state-text">No {config.label.toLowerCase()} logged{filter !== 'all' ? ' in this view' : ''}.</div>
            </div>
          ) : (
            records.map(rec => {
              const sm = statusMeta(rec.status)
              const sev = config.hasSeverity ? severityMeta(rec.severity) : null
              return (
                <button key={rec.id} onClick={() => openRecord(rec)} style={{
                  width: '100%', textAlign: 'left', background: 'var(--white)',
                  border: `1.5px solid ${sm.color}44`, borderRadius: 'var(--radius-md)',
                  padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: sm.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {rec[config.rowPrimary] || config.singular}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 5 }}>
                      {rec.logged ? `${rec.logged.first_name} ${rec.logged.last_name}` : '—'}
                      {isHQ() && rec.sites && ` · ${rec.sites.name}`}
                      {' · '}{timeAgo(rec.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {sev && (
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sev.bg, color: sev.color }}>{sev.label}</span>
                    )}
                    <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>{sm.label}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Add form modal */}
      {showAdd && (
        <AddRecordForm config={config} scopedSiteId={scopedSiteId} staffId={staff.id}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); showToast(`${config.singular} logged ✓`); onChanged?.(); /* realtime refreshes list */ }}
        />
      )}

      {/* Detail modal */}
      {selected && (() => {
        const sm = statusMeta(selected.status)
        const sev = config.hasSeverity ? severityMeta(selected.severity) : null
        return (
          <div className="modal-overlay" style={{ alignItems: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && setSelected(null)}>
            <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', margin: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--navy)', lineHeight: 1.3 }}>
                  {config.icon} {config.singular}
                </div>
                <button onClick={() => setSelected(null)} aria-label="Close" style={{
                  background: 'var(--off-white)', border: 'none', borderRadius: '50%', width: 30, height: 30,
                  fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {sev && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sev.bg, color: sev.color }}>{sev.label}</span>}
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>{sm.label}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Logged {formatDate(selected.created_at)}
                {selected.logged && ` by ${selected.logged.first_name} ${selected.logged.last_name}`}
                {isHQ() && selected.sites && ` · ${selected.sites.name}`}
              </div>

              {/* All configured fields */}
              {config.fields.map(f => {
                const val = selected[f.name]
                if (val === null || val === undefined || val === '') return null
                let display = val
                if (f.type === 'datetime') display = formatDate(val)
                else if (f.type === 'select') display = (f.options.find(o => o.value === val)?.label) || val
                else if (f.type === 'severity') return null // shown as badge above
                // Make email + phone tappable for quick lead follow-up.
                let displayNode = <span style={{ whiteSpace: 'pre-wrap' }}>{display}</span>
                if (f.name === 'email') displayNode = <a href={`mailto:${val}`} style={{ color: 'var(--aqua-dark)', fontWeight: 600 }}>{val}</a>
                else if (f.name === 'phone') displayNode = <a href={`tel:${val}`} style={{ color: 'var(--aqua-dark)', fontWeight: 600 }}>{val}</a>
                return (
                  <div key={f.name} style={{ background: 'var(--off-white)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{displayNode}</div>
                  </div>
                )
              })}

              {/* Photos */}
              {config.hasImages && detailImages.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Photos ({detailImages.length})</div>
                  <div className="image-preview-grid">
                    {detailImages.map(img => (
                      <img key={img.id} src={img.image_url} className="image-preview" alt=""
                        onClick={() => window.open(img.image_url, '_blank')} style={{ cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Collected-by / resolved-by summaries */}
              {config.promptOnStatus && selected[config.promptOnStatus.field] && (
                <div style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                    ✓ {config.promptOnStatus.label}: {selected[config.promptOnStatus.field]}
                    {config.promptOnStatus.timestampField && selected[config.promptOnStatus.timestampField] && ` · ${formatDate(selected[config.promptOnStatus.timestampField])}`}
                    {selected.actioner && ` · marked by ${selected.actioner.first_name} ${selected.actioner.last_name}`}
                  </div>
                </div>
              )}
              {config.resolveStatus && selected.status === config.resolveStatus && selected.resolved_at && (
                <div style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                    ✓ {statusMeta(config.resolveStatus).label} {formatDate(selected.resolved_at)}
                    {selected.resolver && ` by ${selected.resolver.first_name} ${selected.resolver.last_name}`}
                  </div>
                </div>
              )}

              {/* Inline collect prompt */}
              {collectingStatus && (
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 12 }}>
                  <label className="form-label">{config.promptOnStatus.label}</label>
                  <input className="form-input" value={collectValue} onChange={e => setCollectValue(e.target.value)}
                    placeholder="Enter name…" autoFocus />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setCollectingStatus(null)} disabled={busy}>Cancel</button>
                    <button className="btn btn-success btn-sm" style={{ flex: 2 }} onClick={confirmCollect} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</button>
                  </div>
                </div>
              )}

              {/* Status action buttons */}
              {!collectingStatus && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {config.statuses.filter(s => s.value !== selected.status).map(s => {
                    const isResolve = config.resolveStatus === s.value
                    return (
                      <button key={s.value} className={`btn ${isResolve ? 'btn-success' : ''}`} disabled={busy}
                        onClick={() => handleStatusClick(s.value)}
                        style={isResolve ? {} : { background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
                        {busy ? 'Updating…' : `Mark ${s.label}`}
                      </button>
                    )
                  })}
                  <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── Add-record form (config-driven) ─────────────────────────────────
function AddRecordForm({ config, scopedSiteId, staffId, onClose, onSaved }) {
  const initial = {}
  config.fields.forEach(f => {
    if (f.type === 'severity') initial[f.name] = 'medium'
    else if (f.type === 'datetime' && f.defaultNow) initial[f.name] = nowLocalInput()
    else initial[f.name] = ''
  })
  const [form, setForm]     = useState(initial)
  const [images, setImages] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const fileRef = useRef()

  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }))

  const addImages = (e) => {
    const files = Array.from(e.target.files)
    setImages(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f) }))])
  }
  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const uploadImage = async (file, recordId) => {
    const ext = file.name.split('.').pop()
    const path = `${config.recordType}/${recordId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    // required-field validation
    for (const f of config.fields) {
      if (f.required && !String(form[f.name] || '').trim()) {
        setError(`Please fill in "${f.label}"`); return
      }
    }
    setSaving(true); setError(null)
    try {
      const payload = { site_id: scopedSiteId, logged_by: staffId }
      config.fields.forEach(f => {
        let v = form[f.name]
        if (f.type === 'datetime') v = toISO(v)
        else if (typeof v === 'string') v = v.trim() || null
        payload[f.name] = v
      })
      const { data: rec, error: insErr } = await supabase
        .from(config.table).insert(payload).select().single()
      if (insErr) throw insErr

      if (config.hasImages) {
        for (const img of images) {
          const url = await uploadImage(img.file, rec.id)
          await supabase.from('record_images').insert({
            record_type: config.recordType, record_id: rec.id, image_url: url,
          })
        }
      }
      onSaved()
    } catch (err) {
      console.error(err)
      setError('Something went wrong — please try again')
    } finally {
      setSaving(false)
    }
  }

  const renderField = (f) => {
    if (f.type === 'severity') {
      return (
        <select className="form-input" value={form[f.name]} onChange={e => setField(f.name, e.target.value)}>
          {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    if (f.type === 'select') {
      return (
        <select className="form-input" value={form[f.name]} onChange={e => setField(f.name, e.target.value)}>
          <option value="">Select…</option>
          {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    if (f.type === 'datetime') {
      return <input type="datetime-local" className="form-input" value={form[f.name]} onChange={e => setField(f.name, e.target.value)} />
    }
    if (f.type === 'textarea') {
      return <textarea className="form-input" rows={3} placeholder={f.placeholder || ''} value={form[f.name]} onChange={e => setField(f.name, e.target.value)} />
    }
    return <input className="form-input" placeholder={f.placeholder || ''} value={form[f.name]} onChange={e => setField(f.name, e.target.value)} />
  }

  // group consecutive "half" fields into rows of two
  const rows = []
  for (let i = 0; i < config.fields.length; i++) {
    const f = config.fields[i]
    const next = config.fields[i + 1]
    if (f.half && next && next.half) { rows.push([f, next]); i++ }
    else rows.push([f])
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{config.icon} New {config.singular}</div>
          <button onClick={onClose} aria-label="Close" disabled={saving} style={{
            background: 'var(--off-white)', border: 'none', borderRadius: '50%', width: 30, height: 30,
            fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {rows.map((row, ri) => (
          <div key={ri} style={row.length === 2 ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } : {}}>
            {row.map(f => (
              <div className="form-group" key={f.name}>
                <label className="form-label">
                  {f.label}{f.required && <span style={{ color: 'var(--danger)' }}> *</span>}
                </label>
                {renderField(f)}
              </div>
            ))}
          </div>
        ))}

        {config.hasImages && (
          <div className="form-group">
            <label className="form-label">Photos (optional)</label>
            <input type="file" accept="image/*" multiple capture="environment" ref={fileRef} style={{ display: 'none' }} onChange={addImages} />
            <div className="image-upload-area" onClick={() => fileRef.current?.click()}>📷 Tap to take photo or choose from library</div>
            {images.length > 0 && (
              <div className="image-preview-grid" style={{ marginTop: 10 }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img.url} className="image-preview" alt="" />
                    <button onClick={() => removeImage(i)} style={{
                      position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} style={{ flex: 1 }} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Saving…' : `Log ${config.singular}`}
          </button>
        </div>
      </div>
    </div>
  )
}
