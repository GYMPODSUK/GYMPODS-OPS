// src/pages/notes/NotesPanel.jsx
// Shows open TEAM MESSAGES (stored in the `notes` table). Messages are now
// written from the single compose sheet (header compose icon → "Message team
// members"), so this panel only DISPLAYS them — the old "+ Note" button is gone.
//
// A team message is addressed to one of:
//   • a shift        — target_shift_id, with target_date = a specific day, or
//                      NULL = "the next one, whichever day"
//   • a team member  — target_staff_id
//   • managers       — legacy notes from before this change (still shown)
//
// Modes:
//   'shift'   FOH shift screen  → this shift's messages (from their day on) + ones for me
//   'me'      shift selector    → messages addressed to me personally
//   'manager' Messages tab      → legacy "for managers" notes + ones for me
//   'all'     manager Home      → every open message at this gym, labelled
//
// Tapping a row opens it on its own; "Mark done" clears it for everyone.
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { dateKey } from '../../lib/schedule'

const dayLabel = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function NotesPanel({ siteId, mode, shiftId }) {
  const { staff } = useAuth()
  const [notes, setNotes]       = useState([])
  const [busyId, setBusyId]     = useState(null)
  const [selected, setSelected] = useState(null)   // the message being read
  const [error, setError]       = useState(null)

  // Which open messages belong in this panel. Filtered here rather than in
  // the query — volumes are tiny and it keeps the rules readable.
  const belongsHere = (n) => {
    const today   = dateKey()
    const forMe   = n.target_type === 'staff' && n.target_staff_id === staff.id
    const dueYet  = !n.target_date || n.target_date <= today
    if (mode === 'shift')   return forMe || (n.target_type === 'shift' && n.target_shift_id === shiftId && dueYet)
    if (mode === 'me')      return forMe
    if (mode === 'manager') return forMe || n.target_type === 'manager'
    return true // 'all'
  }

  const loadNotes = async () => {
    if (!siteId) { setNotes([]); return }
    const { data, error: qErr } = await supabase
      .from('notes')
      .select(`*,
        author:author_id ( first_name, last_name ),
        shift:target_shift_id ( name ),
        target_staff:target_staff_id ( first_name, last_name )`)
      .eq('site_id', siteId).eq('status', 'open')
      .order('created_at', { ascending: false })
    if (qErr) console.error('notes query error:', qErr)
    setNotes((data || []).filter(belongsHere))
  }

  useEffect(() => { loadNotes() /* eslint-disable-next-line */ }, [siteId, mode, shiftId, staff?.id])

  useEffect(() => {
    if (!siteId) return
    const channel = supabase
      .channel(`notes-sync-${siteId}-${mode}-${shiftId || 'none'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `site_id=eq.${siteId}` },
        () => loadNotes())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, mode, shiftId, staff?.id])

  // If the open message gets cleared by someone else, close the focused view.
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
      setError(upErr.message || 'Could not mark this done — please try again')
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

  const personName = (p) => (p ? `${p.first_name} ${p.last_name}` : '—')

  // Who a message is for, e.g. "for you", "for Thu 26 Sep · Morning",
  // "for next Evening shift", "for Sarah Khan", "for managers".
  const targetLabel = (n) => {
    if (n.target_type === 'staff') {
      return n.target_staff_id === staff.id ? 'for you' : `for ${personName(n.target_staff)}`
    }
    if (n.target_type === 'shift') {
      const name = n.shift?.name || 'a shift'
      return n.target_date ? `for ${dayLabel(n.target_date)} · ${name}` : `for next ${name} shift`
    }
    return 'for managers'
  }

  const heading = mode === 'shift' ? '📌 Messages for this shift'
    : mode === 'me' ? '📌 Messages for you'
    : mode === 'manager' ? '📌 Team messages for you'
    : '📌 Open team messages'

  // Nothing open → take up no space at all.
  if (notes.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
        {heading}<span style={{ color: 'var(--danger)' }}> · {notes.length}</span>
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
              {personName(n.author)}
              {' · '}{targetLabel(n)}
              {' · '}{timeAgo(n.created_at)}
            </div>
          </div>
          <div style={{ fontSize: 18, color: 'var(--text-light)', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>›</div>
        </button>
      ))}

      {/* Focused view — one message, full text, nothing else in the way */}
      {selected && (
        <div className="modal-overlay" style={{ alignItems: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', margin: 'auto' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>
                📌 Message {targetLabel(selected)}
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
              From <strong style={{ color: 'var(--text-primary)' }}>{personName(selected.author)}</strong>
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
              Marking done clears this message for everyone.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
