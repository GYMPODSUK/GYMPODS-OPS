// src/pages/manager/shared/ComposeMessage.jsx
// The ONE compose sheet (header compose icon). Two routes:
//   • Message managers      → `messages` table → Messages tab + email alert
//   • Message team members  → `notes` table    → shows on the chosen shift
//                             (a shift this week, or the next one whichever
//                             day) OR on one team member's screens, until
//                             marked done. No email.
// Replaces the old "+ Note" button and the "Handover note" message type.
import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { shiftRunsOn, dateKey } from '../../../lib/schedule'

const TYPE_OPTIONS = [
  { value: 'general',     label: '💬 General' },
  { value: 'member_note', label: '👤 Member note' },
  { value: 'photo',       label: '📷 Photo' },
]

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '🔴 Urgent', hint: 'Managers are notified immediately' },
  { value: 'normal', label: '🟡 Normal', hint: 'Appears in the day-to-day feed' },
  { value: 'fyi',    label: '⚪ FYI',    hint: 'Low priority — logged for reference' },
]

const DAYS_AHEAD = 7

// "Thu 26 Sep"
const dayLabel = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export default function ComposeMessage({ onClose, onSent }) {
  const { staff } = useAuth()
  // HQ / Region Mgr have no site_id of their own — use the site they're viewing.
  const siteId = staff.active_site_id || staff.site_id

  const [audience, setAudience] = useState(null)      // null | 'manager' | 'team'
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  // ── Manager message fields ──
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [type, setType]         = useState('general')
  const [priority, setPriority] = useState('normal')
  const [images, setImages]     = useState([])
  const fileRef = useRef()

  // ── Team message fields ──
  const [teamTarget, setTeamTarget] = useState('shift') // 'shift' | 'staff'
  const [shiftChoice, setShiftChoice] = useState('')    // "shiftId|" or "shiftId|YYYY-MM-DD"
  const [staffChoice, setStaffChoice] = useState('')
  const [noteBody, setNoteBody]       = useState('')
  const [shifts, setShifts]           = useState([])
  const [team, setTeam]               = useState({ recent: [], others: [] })
  const [loadingTeam, setLoadingTeam] = useState(false)

  // Load shifts + team only when the team route is chosen.
  useEffect(() => {
    if (audience !== 'team' || !siteId) return
    let cancelled = false
    const load = async () => {
      setLoadingTeam(true)
      const since = new Date(); since.setDate(since.getDate() - 7)
      const [shiftRes, staffRes, recentRes] = await Promise.all([
        supabase.from('shift_definitions')
          .select('id, name, days_of_week, order_index')
          .eq('site_id', siteId).order('order_index'),
        supabase.from('staff')
          .select('id, first_name, last_name, role')
          .eq('site_id', siteId).eq('active', true).order('first_name'),
        supabase.from('task_completions')
          .select('staff_id')
          .eq('site_id', siteId).gte('date', dateKey(since)),
      ])
      if (cancelled) return
      if (shiftRes.error)  console.error('shifts load error:', shiftRes.error)
      if (staffRes.error)  console.error('staff load error:', staffRes.error)
      if (recentRes.error) console.error('recent staff load error:', recentRes.error)

      const recentIds = new Set((recentRes.data || []).map(r => r.staff_id))
      const everyone  = (staffRes.data || []).filter(s => s.id !== staff.id)
      setShifts(shiftRes.data || [])
      setTeam({
        recent: everyone.filter(s => recentIds.has(s.id)),
        others: everyone.filter(s => !recentIds.has(s.id)),
      })
      setLoadingTeam(false)
    }
    load()
    return () => { cancelled = true }
  }, [audience, siteId, staff.id])

  // Shifts actually running over the next 7 days, grouped by day.
  const upcomingDays = []
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(); d.setDate(d.getDate() + i)
    const running = shifts.filter(s => shiftRunsOn(s, d))
    if (running.length) upcomingDays.push({ date: d, key: dateKey(d), shifts: running })
  }

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files)
    setImages(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f) }))])
  }
  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const uploadImage = async (file, messageId) => {
    const ext = file.name.split('.').pop()
    const path = `${messageId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('message-images').upload(path, file)
    if (upErr) throw upErr
    const { data } = supabase.storage.from('message-images').getPublicUrl(path)
    return data.publicUrl
  }

  const sendToManagers = async () => {
    if (!title.trim()) { setError('Please add a title'); return }
    setSaving(true); setError(null)
    try {
      const { data: message, error: msgErr } = await supabase
        .from('messages')
        .insert({
          site_id:  siteId,
          staff_id: staff.id,
          type,
          priority,
          title:    title.trim(),
          body:     body.trim() || null,
        })
        .select()
        .single()
      if (msgErr) throw msgErr

      for (const img of images) {
        const url = await uploadImage(img.file, message.id)
        await supabase.from('message_images').insert({ message_id: message.id, image_url: url })
      }
      onSent?.()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Something went wrong — please try again')
    } finally {
      setSaving(false)
    }
  }

  const sendToTeam = async () => {
    if (!noteBody.trim()) { setError('Please write your message'); return }
    if (teamTarget === 'shift' && !shiftChoice) { setError('Choose which shift this is for'); return }
    if (teamTarget === 'staff' && !staffChoice) { setError('Choose who this is for'); return }
    setSaving(true); setError(null)

    let payload = { site_id: siteId, author_id: staff.id, body: noteBody.trim() }
    if (teamTarget === 'shift') {
      const [shiftId, date] = shiftChoice.split('|')
      payload = { ...payload, target_type: 'shift', target_shift_id: shiftId, target_date: date || null }
    } else {
      payload = { ...payload, target_type: 'staff', target_staff_id: staffChoice }
    }

    const { error: insErr } = await supabase.from('notes').insert(payload)
    setSaving(false)
    if (insErr) {
      console.error('team message insert failed:', insErr)
      setError('Something went wrong — please try again')
      return
    }
    onSent?.()
    onClose()
  }

  // ── Small UI pieces ──
  const ToggleBtn = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      background: active ? 'var(--navy)' : 'var(--off-white)',
      color: active ? 'var(--white)' : 'var(--text-secondary)',
      border: `1px solid ${active ? 'var(--navy)' : 'var(--border)'}`,
    }}>{children}</button>
  )

  const AudienceCard = ({ value, icon, label, hint }) => (
    <button onClick={() => { setError(null); setAudience(value) }} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 10,
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 14,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 26, lineHeight: 1 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>{hint}</div>
      </div>
      <div style={{ fontSize: 18, color: 'var(--text-light)' }}>›</div>
    </button>
  )

  const heading = audience === 'manager' ? '📨 Message managers'
    : audience === 'team' ? '👥 Message team members'
    : 'New message'

  const personName = (s) => `${s.first_name} ${s.last_name}`

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="modal-title" style={{ margin: 0 }}>{heading}</div>
          {audience && !saving && (
            <button onClick={() => { setError(null); setAudience(null) }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, color: 'var(--aqua-dark)',
            }}>‹ Change</button>
          )}
        </div>

        {/* ── Step 1: who is it for? ── */}
        {!audience && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Who's it for?</div>
            <AudienceCard value="team" icon="👥" label="Message team members"
              hint="For a shift this week or a team member. Stays on their screen until it's done." />
            <AudienceCard value="manager" icon="📨" label="Message managers"
              hint="Member notes, general messages and photos for the management team." />
            <button className="btn btn-outline btn-sm" onClick={onClose} style={{ width: '100%', marginTop: 4 }}>Cancel</button>
          </>
        )}

        {/* ── Team members route ── */}
        {audience === 'team' && (
          <>
            <div className="form-group">
              <label className="form-label">Send to</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <ToggleBtn active={teamTarget === 'shift'} onClick={() => setTeamTarget('shift')}>A shift</ToggleBtn>
                <ToggleBtn active={teamTarget === 'staff'} onClick={() => setTeamTarget('staff')}>A team member</ToggleBtn>
              </div>
            </div>

            {loadingTeam ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><div className="spinner" /></div>
            ) : teamTarget === 'shift' ? (
              <div className="form-group">
                <label className="form-label">Which shift</label>
                <select className="form-input" value={shiftChoice} onChange={e => setShiftChoice(e.target.value)}>
                  <option value="">Choose a shift…</option>
                  {shifts.length > 0 && (
                    <optgroup label="Next shift (whichever day)">
                      {shifts.map(s => <option key={`next-${s.id}`} value={`${s.id}|`}>Next {s.name} shift</option>)}
                    </optgroup>
                  )}
                  {upcomingDays.map((day, i) => (
                    <optgroup key={day.key} label={i === 0 ? `Today · ${dayLabel(day.date)}` : dayLabel(day.date)}>
                      {day.shifts.map(s => (
                        <option key={`${day.key}-${s.id}`} value={`${s.id}|${day.key}`}>
                          {dayLabel(day.date)} · {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {shifts.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>No shifts set up at this gym yet.</div>
                )}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Which team member</label>
                <select className="form-input" value={staffChoice} onChange={e => setStaffChoice(e.target.value)}>
                  <option value="">Choose a team member…</option>
                  {team.recent.length > 0 && (
                    <optgroup label="On this week">
                      {team.recent.map(s => <option key={s.id} value={s.id}>{personName(s)}</option>)}
                    </optgroup>
                  )}
                  {team.others.length > 0 && (
                    <optgroup label={team.recent.length ? 'Everyone else' : 'Team'}>
                      {team.others.map(s => <option key={s.id} value={s.id}>{personName(s)}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-input" rows={4}
                placeholder="e.g. Delivery due tomorrow AM — please receive it"
                value={noteBody} onChange={e => setNoteBody(e.target.value)} />
            </div>
          </>
        )}

        {/* ── Managers route (same as before, minus Handover) ── */}
        {audience === 'manager' && (
          <>
            <div className="form-group">
              <label className="form-label">Title <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" placeholder="Brief summary…"
                value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', marginTop: -4, marginBottom: 14,
              padding: '6px 10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)'
            }}>
              {PRIORITY_OPTIONS.find(o => o.value === priority)?.hint}
            </div>

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea className="form-input" rows={3} placeholder="Add more detail…"
                value={body} onChange={e => setBody(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Photos (optional)</label>
              <input type="file" accept="image/*" multiple capture="environment"
                ref={fileRef} style={{ display: 'none' }} onChange={handleImageAdd} />
              <div className="image-upload-area" onClick={() => fileRef.current?.click()}>
                📷 Tap to take photo or choose from library
              </div>
              {images.length > 0 && (
                <div className="image-preview-grid" style={{ marginTop: 10 }}>
                  {images.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={img.url} className="image-preview" alt="" />
                      <button onClick={() => removeImage(i)} style={{
                        position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)',
                        color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22,
                        fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <div style={{
            color: 'var(--danger)', fontSize: 13, marginBottom: 10,
            padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)'
          }}>{error}</div>
        )}

        {audience && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={onClose} style={{ flex: 1 }} disabled={saving}>Cancel</button>
            {audience === 'manager' ? (
              <button className="btn btn-primary" onClick={sendToManagers}
                disabled={saving || !title.trim()} style={{ flex: 2 }}>
                {saving ? 'Sending…' : 'Send to managers'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={sendToTeam}
                disabled={saving || loadingTeam || !noteBody.trim()} style={{ flex: 2 }}>
                {saving ? 'Sending…' : 'Send to team'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
