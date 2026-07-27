// src/pages/notes/ComposeNote.jsx
// Create a cross-shift note aimed at a specific shift OR at managers.
import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ComposeNote({ siteId, authorId, shifts, defaultShiftId, onClose, onSaved }) {
  const [body, setBody]           = useState('')
  const [targetType, setTargetType] = useState(defaultShiftId ? 'shift' : 'shift')
  const [shiftId, setShiftId]     = useState(defaultShiftId || (shifts[0]?.id || ''))
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const save = async () => {
    if (!body.trim()) { setError('Please write the note'); return }
    if (targetType === 'shift' && !shiftId) { setError('Choose which shift this is for'); return }
    setSaving(true); setError(null)
    const payload = {
      site_id: siteId, author_id: authorId, body: body.trim(),
      target_type: targetType,
      target_shift_id: targetType === 'shift' ? shiftId : null,
    }
    const { error: insErr } = await supabase.from('notes').insert(payload)
    if (insErr) { console.error(insErr); setError('Something went wrong — please try again'); setSaving(false); return }
    onSaved?.()
    onClose()
  }

  const TargetBtn = ({ value, label }) => (
    <button onClick={() => setTargetType(value)} style={{
      flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      background: targetType === value ? 'var(--navy)' : 'var(--off-white)',
      color: targetType === value ? 'var(--white)' : 'var(--text-secondary)',
      border: `1px solid ${targetType === value ? 'var(--navy)' : 'var(--border)'}`,
    }}>{label}</button>
  )

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>📌 Leave a note</div>
          <button onClick={onClose} aria-label="Close" disabled={saving} style={{
            background: 'var(--off-white)', border: 'none', borderRadius: '50%', width: 30, height: 30,
            fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Note</label>
          <textarea className="form-input" rows={3} autoFocus placeholder="e.g. Delivery due tomorrow AM — please receive it"
            value={body} onChange={e => setBody(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Who is this for?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <TargetBtn value="shift" label="A shift" />
            <TargetBtn value="manager" label="Managers" />
          </div>
        </div>

        {targetType === 'shift' && (
          <div className="form-group">
            <label className="form-label">Which shift</label>
            <select className="form-input" value={shiftId} onChange={e => setShiftId(e.target.value)}>
              {shifts.length === 0 && <option value="">No shifts found</option>}
              {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} style={{ flex: 1 }} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Saving…' : 'Leave note'}
          </button>
        </div>
      </div>
    </div>
  )
}
