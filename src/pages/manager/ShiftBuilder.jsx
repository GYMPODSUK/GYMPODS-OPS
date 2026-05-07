import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const CAT_COLORS = {
  cleaning: '#2A8A8E', health_safety: '#C07010',
  maintenance: '#5A4A9A', opening_closing: '#2A5A8E', other: '#4A6A7A'
}

export default function ShiftBuilder() {
  const { staff } = useAuth()
  const [shifts, setShifts] = useState([])
  const [selectedShift, setSelectedShift] = useState(null)
  const [assignedTasks, setAssignedTasks] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { loadShifts() }, [])
  useEffect(() => { if (selectedShift) loadAssignedTasks(selectedShift.id) }, [selectedShift])

  const loadShifts = async () => {
    setLoading(true)
    const { data: shiftData } = await supabase
      .from('shift_definitions').select('*')
      .eq('site_id', staff.site_id).order('order_index')
    const { data: taskData } = await supabase
      .from('task_library').select('*')
      .eq('site_id', staff.site_id).order('category').order('name')
    setShifts(shiftData || [])
    setAllTasks(taskData || [])
    if (shiftData?.length) setSelectedShift(shiftData[0])
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
    setTimeout(() => setToast(null), 2000)
  }

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

  const assignedIds = new Set(assignedTasks.map(t => t.task_id))
  const unassigned = allTasks.filter(t => !assignedIds.has(t.id))

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  // Wrapper takes full height, splits into fixed header + scrollable list
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
              Assign tasks to each shift
            </div>
          </div>
          <button className="btn btn-primary btn-sm"
            onClick={() => setShowPicker(true)}
            style={{ width: 'auto' }} disabled={!selectedShift}>
            + Add task
          </button>
        </div>

        {/* Shift tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, WebkitOverflowScrolling: 'touch' }}>
          {shifts.map(shift => (
            <button key={shift.id} onClick={() => setSelectedShift(shift)} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
              background: selectedShift?.id === shift.id ? 'var(--navy)' : 'var(--off-white)',
              color: selectedShift?.id === shift.id ? 'var(--white)' : 'var(--text-secondary)',
              border: `1px solid ${selectedShift?.id === shift.id ? 'var(--navy)' : 'var(--border)'}`,
            }}>
              {shift.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable task list ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px 24px',
        WebkitOverflowScrolling: 'touch'
      }}>
        {!selectedShift ? (
          <div className="empty-state"><div className="empty-state-text">No shifts configured yet.</div></div>
        ) : assignedTasks.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No tasks in {selectedShift.name}.<br/>Tap "+ Add task" to assign tasks.</div>
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
                  {st.task_library?.frequency && st.task_library.frequency !== 'session'
                    ? `${st.task_library.frequency} · ` : ''}
                  {st.task_library?.category} · #{idx + 1}
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
      </div>

      {/* Task picker */}
      {showPicker && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPicker(false)}>
          <div className="modal-sheet" style={{ maxHeight: '70vh' }}>
            <div className="modal-handle" />
            <div className="modal-title">Add task to {selectedShift?.name}</div>
            {unassigned.length === 0 ? (
              <div className="empty-state"><div className="empty-state-text">All tasks already assigned.</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unassigned.map(task => (
                  <button key={task.id} onClick={() => { addTask(task); setShowPicker(false) }} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--white)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    padding: '12px 14px', cursor: 'pointer', textAlign: 'left', width: '100%'
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS[task.category] || '#888', flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{task.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {task.frequency !== 'session' ? `${task.frequency} · ` : ''}{task.category}
                      </div>
                    </div>
                    <span style={{ color: 'var(--aqua)', fontWeight: 700, flexShrink: 0 }}>+</span>
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn-outline" onClick={() => setShowPicker(false)} style={{ marginTop: 12 }}>Done</button>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
