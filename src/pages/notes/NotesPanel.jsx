// src/pages/notes/NotesPanel.jsx
// Cross-shift notes. A note targets a specific shift OR managers, and
// stays until someone reads it and marks it done (then it disappears
// for everyone via realtime). Used on the FOH shift screen (mode="shift")
// and the manager Messages page (mode="manager").
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ComposeNote from './ComposeNote'

export default function NotesPanel({ siteId, mode, shiftId, shiftName }) {
  const { staff } = useAuth()
  const [notes, setNotes]       = useState([])
  const [shifts, setShifts]     = useState([])
  const [composing, setComposing] = useState(false)
  const [busyId, setBusyId]     = useState(null)
  const [expanded, setExpanded] = useState(null)

  const loadNotes = async () => {
    if (!siteId) { setNotes([]); return }
    let q = supabase
      .from('notes')
      .select('*, author:author_id ( first_name, last_name ), shift:target_shift_id ( name )')
      .eq('site_id', siteId).eq('status', 'open')
      .order('created_at', { ascending: false })
    // mode 'shift'   → just this shift's notes (FOH shift screen)
    // mode 'manager'  → only notes addressed to managers
    // mode 'all'      → every open note at this gym, labelled by who it's for
    if (mode === 'shift')        q = q.eq('target_type', 'shift').eq('target_shift_id', shiftId)
    else if (mode === 'manager') q = q.eq('target_type', 'manager')
    const { data, error } = await q
    if (error) console.error('notes query error:', error)
    setNotes(data || [])
  }

  const loadShifts = async () => {
    if (!siteId) return
    const { data } = await supabase
      .from('shift_definitions').select('id, name').eq('site_id', siteId).order('order_index')
    setShifts(data || [])
  }

  useEffect(() => { loadNotes(); loadShifts() /* eslint-disable-next-line */ }, [siteId, mode, shiftId])

  useEffect(() => {
    if (!siteId) return
    const channel = supabase
      .channel(`notes-sync-${siteId}-${mode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `site_id=eq.${siteId}` },
        () => loadNotes())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, mode, shiftId])

  const markDone = async (id) => {
    setBusyId(id)
    await supabase.from('notes').update({
      status: 'done', done_by: staff.id, done_at: new Date().toISOString(),
    }).eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id)) // instant; realtime reconciles
    setBusyId(null)
  }

  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const heading = mode === 'shift' ? '📌 Shift notes'
    : mode === 'all' ? '📌 Open notes'
    : '📌 Notes for managers'

  // Who a note is addressed to — only worth showing when the panel mixes types.
  const targetLabel = (n) =>
    n.target_type === 'shift' ? `for ${n.shift?.name || 'a shift'}` : 'for managers'

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: notes.length ? 8 : 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
          {heading}{notes.length > 0 && <span style={{ color: 'var(--danger)' }}> · {notes.length}</span>}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setComposing(true)}>+ Note</button>
      </div>

      {notes.map(n => (
        <div key={n.id} style={{
          background: 'var(--warning-bg)', border: '1px solid rgba(232,144,26,0.25)',
          borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 8,
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.body}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
            {n.author ? `${n.author.first_name} ${n.author.last_name}` : '—'}
            {mode !== 'shift' && ` · ${targetLabel(n)}`}
            {' · '}{timeAgo(n.created_at)}
          </div>
          <button className="btn btn-success btn-sm" style={{ width: '100%', marginTop: 10 }}
            disabled={busyId === n.id} onClick={() => markDone(n.id)}>
            {busyId === n.id ? 'Saving…' : '✓ Mark done'}
          </button>
        </div>
      ))}

      {composing && (
        <ComposeNote
          siteId={siteId} authorId={staff.id} shifts={shifts}
          defaultShiftId={mode === 'shift' ? shiftId : null}
          onClose={() => setComposing(false)}
          onSaved={loadNotes}
        />
      )}
    </div>
  )
}
