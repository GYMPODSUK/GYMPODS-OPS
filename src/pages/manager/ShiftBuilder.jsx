import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const CAT_COLORS = {
  cleaning: '#2A8A8E', health_safety: '#C07010',
  maintenance: '#5A4A9A', opening_closing: '#2A5A8E', other: '#4A6A7A'
}

const CAT_LABELS = {
  cleaning: 'Cleaning', health_safety: 'H&S',
  maintenance: 'Maintenance', opening_closing: 'Opening/Closing', other: 'Other'
}

const ROLE_OPTIONS = [
  { value: 'trainee',    label: 'Trainee' },
  { value: 'cleaner',    label: 'Cleaner' },
  { value: 'foh',        label: 'FOH' },
  { value: 'senior_foh', label: 'Senior FOH' },
]

const EMPTY_FORM = {
  name: '',
  start_time: '06:00',
  end_time: '14:00',
  visible_to_roles: ['foh', 'senior_foh'],
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour < 12 ? 'am' : 'pm'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${m}${ampm}`
}

function RoleCheckboxes({ selected, onChange }) {
  const toggle = (role) => {
    const updated = selected.includes(role)
      ? selected.filter(r => r !== role)
      : [...selected, role]
    onChange(updated)
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {ROLE_OPTIONS.map(r => {
        const active = selected.includes(r.value)
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => toggle(r.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: active ? 'var(--navy)' : 'var(--off-white)',
              color: active ? 'var(--white)' : 'var(--text-secondary)',
              border: `1px solid ${active ? 'var(--navy)' : 'var(--border)'}`,
            }}
          >
            {active ? '✓ ' : ''}{r.label}
          </button>
        )
      })}
    </div>
  )
}

export default function ShiftBuilder() {
  const { staff } = useAuth()
  const [shifts, setShifts]               = useState([])
  const [selectedShift, setSelectedShift] = useState(null)
  const [assignedTasks, setAssignedTasks] = useState([])
  const [allTasks, setAllTasks]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [showPicker, setShowPicker]       = useState(false)
  const [shiftModal, setShiftModal]       = useState(null)
  const [formData, setFormData]           = useState(EMPTY_FORM)
  const [formSaving, setFormSaving]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toast, setToast]                 = useState(null)
  const [searchQuery, setSearchQuery]     = useState('')

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selectedShift) loadAssignedTasks(selectedShift.id) }, [selectedShift])

  const loadData = async () => {
    setLoading(true)
    const { data: shiftData } = await supabase
      .from('shift_definitions').select('*')
      .eq('site_id', staff.site_id).order('order_index')
    const { data: taskData } = await supabase
      .from('task_library').select('*')
      .or(`site_id.eq.${staff.site_id},is_global.eq.true`)
      .order('category').order('name')
    setShifts(shiftData || [])
    setAllTasks(taskData || [])
    if (shiftData?.length) setSelectedShift(prev => {
      const still = shiftData.find(s => s.id === prev?.id)
      return still || shiftData[0]
    })
    setLoading(false)
  }

  const loadAssignedTasks = async (shiftId) => {
    const { data } = await supabase
      .from('shift_tasks').select('*, task_library(*)')
      .eq('shift_id', shiftId).order('order_index')
    setAssignedTasks(data || [])
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  // ── Shift CRUD ──────────────────────────────────────────────────────────

  const openNewShift = () => {
    setFormData(EMPTY_FORM)
    setShiftModal('new')
  }

  const openEditShift = (shift, e) => {
    e.stopPropagation()
    setFormData({
      name:             shift.name,
      start_time:       shift.start_time,
      end_time:         shift.end_time,
      visible_to_roles: shift.visible_to_roles || ['foh', 'senior_foh'],
    })
    setShiftModal(shift)
  }

  const handleShiftSave = async () => {
    if (!formData.name.trim()) return
    if (formData.visible_to_roles.length === 0) {
      showToast('Select at least one role', 'error')
      return
    }
    setFormSaving(true)
    try {
      if (shiftModal === 'new') {
        const maxOrder = shifts.reduce((m, s) => Math.max(m, s.order_index), 0)
        const { error } = await supabase.from('shift_definitions').insert({
          site_id:          staff.site_id,
          name:             formData.name.trim(),
          start_time:       formData.start_time,
          end_time:         formData.end_time,
          visible_to_roles: formData.visible_to_roles,
          order_index:      maxOrder + 1,
        })
        if (error) throw error
        showToast('Shift created')
      } else {
        const { error } = await supabase.from('shift_definitions').update({
          name:             formData.name.trim(),
          start_time:       formData.start_time,
          end_time:         formData.end_time,
          visible_to_roles: formData.visible_to_roles,
        }).eq('id', shiftModal.id)
        if (error) throw error
        showToast('Shift updated')
      }
      setShiftModal(null)
      await loadData()
    } catch (err) {
      console.error(err)
      showToast('Something went wrong', 'error')
    } finally {
      setFormSaving(false)
    }
  }

  const handleShiftDelete = async (shift) => {
    try {
      await supabase.from('shift_tasks').delete().eq('shift_id', shift.id)
      await supabase.from('shift_definitions').delete().eq('id', shift.id)
      showToast('Shift deleted')
      setDeleteConfirm(null)
      setShiftModal(null)
      setSelectedShift(null)
      await loadData()
    } catch (err) {
      console.error(err)
      showToast('Could not delete shift', 'error')
    }
  }

  // ── Task assignment ─────────────────────────────────────────────────────

  const addTask = async (task) => {
    const maxOrder = assignedTasks.reduce((m, t) => Math.max(m, t.order_index), 0)
    const { error } = await supabase.from('shift_tasks').insert({
      shift_id: selectedShift.id, task_id: task.id, order_index: maxOrder + 1
    })
    if (error) { showToast('Task already assigned', 'error'); return }
    showToast('Task added')
    loadAssignedTasks(selectedShift.id)
  }

  const removeTask = async (st) => {
    await supabase.from('shift_tasks').delete().eq('id', st.id)
    showToast('Task removed')
    loadAssignedTasks(selectedShift.id)
  }

  const moveTask = async (idx, dir) => {
    const tasks = [...assignedTasks]
    const target = idx + dir
    if (target < 0 || target >= tasks.length) return
    const a = tasks[idx], b = tasks[target]
    await supabase.from('shift_tasks').update({ order_index: b.order_index }).eq('id', a.id)
    await supabase.from('shift_tasks').update({ order_index: a.order_index }).eq('id', b.id)
    loadAssignedTasks(selectedShift.id)
  }

  const assignedIds        = new Set(assignedTasks.map(t => t.task_id))
  const unassigned         = allTasks.filter(t => !assignedIds.has(t.id))
  const filteredUnassigned = searchQuery.trim()
    ? unassigned.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : unassigned
  const groupedUnassigned  = filteredUnassigned.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Fixed header ── */}
      <div style={{
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px 0', flexShrink: 0, zIndex: 2
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>Shift Builder</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
              Manage shifts and assign tasks
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openNewShift} style={{ width: 'auto' }}>
            + New shift
          </button>
        </div>

        {/* Shift tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, WebkitOverflowScrolling: 'touch' }}>
          {shifts.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-light)', padding: '6px 0' }}>
              No shifts yet — tap "+ New shift" to add one.
            </div>
          )}
          {shifts.map(shift => (
            <div key={shift.id} style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setSelectedShift(shift)} style={{
                padding: '7px 32px 7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s',
                background: selectedShift?.id === shift.id ? 'var(--navy)' : 'var(--off-white)',
                color: selectedShift?.id === shift.id ? 'var(--white)' : 'var(--text-secondary)',
                border: `1px solid ${selectedShift?.id === shift.id ? 'var(--navy)' : 'var(--border)'}`,
              }}>
                {shift.name}
                <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>
                  {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
                </span>
              </button>
              <button onClick={(e) => openEditShift(shift, e)} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                color: selectedShift?.id === shift.id ? 'rgba(255,255,255,0.7)' : 'var(--text-light)',
                padding: '2px 4px', lineHeight: 1,
              }} title="Edit shift">✎</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Task list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px', WebkitOverflowScrolling: 'touch' }}>
        {!selectedShift ? (
          <div className="empty-state">
            <div className="empty-state-icon">🗓</div>
            <div className="empty-state-text">No shifts yet. Tap "+ New shift" to get started.</div>
          </div>
        ) : (
          <>
            {/* Role visibility badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>Visible to:</span>
              {(selectedShift.visible_to_roles || []).map(role => (
                <span key={role} style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                  background: 'var(--aqua-light)', color: 'var(--navy)',
                }}>
                  {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
                </span>
              ))}
              <button onClick={(e) => openEditShift(selectedShift, e)} style={{
                fontSize: 11, color: 'var(--aqua)', fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0
              }}>Edit ›</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {assignedTasks.length} task{assignedTasks.length !== 1 ? 's' : ''} in {selectedShift.name}
              </div>
              <button className="btn btn-primary btn-sm"
                onClick={() => setShowPicker(true)} style={{ width: 'auto' }}>
                + Add task
              </button>
            </div>

            {assignedTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-text">No tasks assigned yet.<br />Tap "+ Add task" to assign tasks.</div>
              </div>
            ) : (
              assignedTasks.map((st, idx) => (
                <div key={st.id} style={{
                  background: 'var(--white)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => moveTask(idx, -1)} disabled={idx === 0} style={{
                      background: 'none', border: 'none', fontSize: 13, lineHeight: 1,
                      color: idx === 0 ? 'var(--border)' : 'var(--text-secondary)',
                      cursor: idx === 0 ? 'default' : 'pointer', padding: '2px 5px'
                    }}>▲</button>
                    <button onClick={() => moveTask(idx, 1)} disabled={idx === assignedTasks.length - 1} style={{
                      background: 'none', border: 'none', fontSize: 13, lineHeight: 1,
                      color: idx === assignedTasks.length - 1 ? 'var(--border)' : 'var(--text-secondary)',
                      cursor: idx === assignedTasks.length - 1 ? 'default' : 'pointer', padding: '2px 5px'
                    }}>▼</button>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: CAT_COLORS[st.task_library?.category] || '#888' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {st.task_library?.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
                      {CAT_LABELS[st.task_library?.category] || st.task_library?.category} · #{idx + 1}
                    </div>
                  </div>
                  <button onClick={() => removeTask(st)} style={{
                    background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none',
                    borderRadius: 'var(--radius-sm)', padding: '5px 10px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0
                  }}>✕</button>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* ── New / Edit shift modal ── */}
      {shiftModal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShiftModal(null)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-title">
              {shiftModal === 'new' ? 'New shift' : `Edit — ${shiftModal.name}`}
            </div>

            <div className="form-group">
              <label className="form-label">Shift name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" placeholder="e.g. Early Morning, Evening Clean…"
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Start time</label>
                <input type="time" className="form-input" value={formData.start_time}
                  onChange={e => setFormData(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">End time</label>
                <input type="time" className="form-input" value={formData.end_time}
                  onChange={e => setFormData(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Visible to <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Tap to select which roles can see this shift
              </div>
              <RoleCheckboxes
                selected={formData.visible_to_roles}
                onChange={roles => setFormData(f => ({ ...f, visible_to_roles: roles }))}
              />
              {formData.visible_to_roles.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>
                  At least one role must be selected
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShiftModal(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleShiftSave}
                disabled={formSaving || !formData.name.trim() || formData.visible_to_roles.length === 0}
                style={{ flex: 2 }}>
                {formSaving ? 'Saving…' : shiftModal === 'new' ? 'Create shift' : 'Save changes'}
              </button>
            </div>

            {shiftModal !== 'new' && (
              <button onClick={() => setDeleteConfirm(shiftModal)} style={{
                marginTop: 16, width: '100%', padding: '10px',
                background: 'none', color: 'var(--danger)',
                border: '1px solid rgba(217,79,79,0.3)', borderRadius: 'var(--radius-md)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
                Delete this shift
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-title">Delete {deleteConfirm.name}?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              This will permanently remove the shift and all its task assignments. Completion logs already recorded will not be affected.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setDeleteConfirm(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleShiftDelete(deleteConfirm)} style={{ flex: 2 }}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task picker ── */}
      {showPicker && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPicker(false)}>
          <div className="modal-sheet" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-handle" />
            <div className="modal-title">Add task to {selectedShift?.name}</div>
            <input className="form-input" placeholder="Search tasks…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ marginBottom: 12 }} />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredUnassigned.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-text">
                    {searchQuery ? 'No tasks match your search.' : 'All tasks already assigned.'}
                  </div>
                </div>
              ) : (
                Object.entries(groupedUnassigned).map(([category, tasks]) => (
                  <div key={category} style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--text-light)',
                      letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6
                    }}>
                      {CAT_LABELS[category] || category}
                    </div>
                    {tasks.map(task => (
                      <button key={task.id}
                        onClick={() => { addTask(task); setShowPicker(false); setSearchQuery('') }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--white)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                          padding: '11px 14px', cursor: 'pointer', textAlign: 'left',
                          width: '100%', marginBottom: 6
                        }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[task.category] || '#888', flexShrink: 0, marginTop: 4 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{task.name}</div>
                          {task.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                              {task.description.length > 60 ? task.description.slice(0, 60) + '…' : task.description}
                            </div>
                          )}
                        </div>
                        <span style={{ color: 'var(--aqua)', fontWeight: 700, flexShrink: 0, fontSize: 18 }}>+</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
            <button className="btn btn-outline" onClick={() => { setShowPicker(false); setSearchQuery('') }}
              style={{ marginTop: 12, flexShrink: 0 }}>Done</button>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
