// src/pages/notes/NotesPanel.jsx
// Cross-shift notes. A note targets a specific shift OR managers, and
// stays until someone reads it and marks it done (then it disappears
// for everyone via realtime). Used on the FOH shift screen (mode="shift"),
// the manager Messages page (mode="manager") and Home (mode="all").
//
// The list shows compact one-note-per-row cards; tapping one opens it on
// its own in a focused view so a long note can't be buried under the
// notes below it. Mark done from there and it clears everywhere.
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ComposeNote from './ComposeNote'

export default function NotesPanel({ siteId, mode, shiftId, shiftName }) {
  const { staff } = useAuth()
  const [notes, setNotes]         = useState([])
  const [shifts, setShifts]       = useState([])
  const [composing, setComposing] = useState(false)
  const [busyId, setBusyId]       = useState(null)
  const [selected, setSelected]   = useState(null)   // the note being read
  const [error, setError]         = useState(null)

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
    const { data, error: qErr } = await q
    if (qErr) console.error('notes query error:', qErr)
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

  // If the open note gets cleared by someone else, close the focused view
  // rather than leaving a stale note on screen.
  useEffect(() => {
    if (selected && !notes.some(n => n.id === selected.id)) setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes])

  const markDone = async (id) => {
    setBusyId(id); setError(null)
    const { error: upErr } = await supabase.from('notes').update({
      status: 'done', done_by: staff.id, done_at: new Date().toISOString(),
    }).eq('id', id)
    setBusyId(null)
    if (upErr) {
      console.error('note mark-done failed:', upErr)
      setError(upErr.message || 'Could not mark this note done — please try again')
      return
    }
    setSelected(null)
    setNotes(prev => prev.filter(n => n.id !== id)) // instant; realtime reconciles
  }

  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }
  const fullWhen = (ts) => new Date(ts).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const heading = mode === 'shift' ? '📌 Shift notes'
    : mode === 'all' ? '📌 Open notes'
    : '📌 Notes for managers'

  // Who a note is addressed to — only worth showing when the panel mixes types.
  const targetLabel = (n) =>
    n.target_type === 'shift' ? `for ${n.shift?.name || 'a shift'}` : 'for managers'

  const authorName = (n) => (n.author ? `${n.author.first_name} ${n.author.last_name}` : '—')

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: notes.length ? 8 : 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
          {heading}{notes.length > 0 && <span style={{ color: 'var(--danger)' }}> · {notes.length}</span>}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setComposing(true)}>+ Note</button>
      </div>

      {/* Compact list — tap a row to read it on its own */}
      {notes.map(n => (
        <button key={n.id} onClick={() => { setError(null); setSelected(n) }} style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          background: 'var(--warning-bg)', border: '1px solid rgba(232,144,26,0.25)',
          borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 8,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>{n.body}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
              {authorName(n)}
              {mode !== 'shift' && ` · ${targetLabel(n)}`}
              {' · '}{timeAgo(n.created_at)}
            </div>
          </div>
          <div style={{ fontSize: 18, color: 'var(--text-light)', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>›</div>
        </button>
      ))}

      {/* Focused note view — one note, full text, nothing else in the way */}
      {selected && (
        <div className="modal-overlay" style={{ alignItems: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', margin: 'auto' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>
                📌 {selected.target_type === 'shift' ? (selected.shift?.name || 'Shift') + ' note' : 'Note for managers'}
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close" disabled={busyId === selected.id} style={{
                background: 'var(--off-white)', border: 'none', borderRadius: '50%', width: 30, height: 30,
                fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            <div style={{
              background: 'var(--warning-bg)', border: '1px solid rgba(232,144,26,0.25)',
              borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 12,
              fontSize: 15, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
            }}>{selected.body}</div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Written by <strong style={{ color: 'var(--text-primary)' }}>{authorName(selected)}</strong>
              <br />{fullWhen(selected.created_at)} · {timeAgo(selected.created_at)}
            </div>

            {error && (
              <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-success" disabled={busyId === selected.id}
                onClick={() => markDone(selected.id)}>
                {busyId === selected.id ? 'Saving…' : '✓ Mark done & clear'}
              </button>
              <button className="btn btn-outline" disabled={busyId === selected.id}
                onClick={() => setSelected(null)}>Keep for now</button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-light)', textAlign: 'center', marginTop: 10 }}>
              Marking done clears this note for everyone.
            </div>
          </div>
        </div>
      )}

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
