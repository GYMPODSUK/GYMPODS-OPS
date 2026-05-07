import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const CAT_COLORS = {
  cleaning: '#2A8A8E', health_safety: '#C07010',
  maintenance: '#5A4A9A', opening_closing: '#2A5A8E', other: '#4A6A7A',
}
const CAT_LABELS = {
  cleaning: 'Cleaning', health_safety: 'H&S',
  maintenance: 'Maintenance', opening_closing: 'Opening/Closing', other: 'Other',
}

export default function ShiftTasks({ shift, locationData, onBack }) {
  const { staff } = useAuth()
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [activeModal, setActiveModal] = useState(null)
  const [comment, setComment] = useState('')
  const [images, setImages] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: taskData } = await supabase
      .from('shift_tasks').select('order_index, task_library(*)')
      .eq('shift_id', shift.id).order('order_index')
    setTasks(taskData?.map(t => t.task_library) || [])

    const { data: compData } = await supabase
      .from('task_completions').select('*')
      .eq('shift_id', shift.id).eq('site_id', staff.site_id)
      .eq('date', today).eq('staff_id', staff.id)
    const compMap = {}
    if (compData) compData.forEach(c => { compMap[c.task_id] = c })
    setCompletions(compMap)
    setLoading(false)
  }

  const showToast = (msg, type = 'default') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  const openModal = (task, mode) => {
    setActiveModal({ task, mode })
    setComment('')
    setImages([])
  }

  const closeModal = () => {
    setActiveModal(null)
    setComment('')
    setImages([])
  }

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files)
    const newImgs = files.map(f => ({ file: f, url: URL.createObjectURL(f) }))
    setImages(prev => [...prev, ...newImgs])
  }

  const uploadImage = async (file, issueId) => {
    const ext = file.name.split('.').pop()
    const path = `${issueId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('issue-images').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('issue-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    if (!activeModal) return
    setSaving(true)
    try {
      const { task, mode } = activeModal
      const { data: comp, error: compErr } = await supabase
        .from('task_completions')
        .insert({
          site_id: staff.site_id, shift_id: shift.id,
          task_id: task.id, staff_id: staff.id,
          date: today,
          status: mode === 'flag' ? 'flagged' : 'completed',
          comment: comment || null,
          on_site: locationData?.onSite ?? null,
          comp_latitude: locationData?.latitude || null,
          comp_longitude: locationData?.longitude || null,
        })
        .select().single()

      if (compErr) throw compErr

      if (mode === 'flag') {
        const { data: issue, error: issueErr } = await supabase
          .from('issues')
          .insert({
            task_completion_id: comp.id, site_id: staff.site_id,
            staff_id: staff.id, task_name: task.name,
            description: comment || null, status: 'open',
          })
          .select().single()
        if (issueErr) throw issueErr
        for (const img of images) {
          const url = await uploadImage(img.file, issue.id)
          await supabase.from('issue_images').insert({ issue_id: issue.id, image_url: url })
        }
      }

      setCompletions(prev => ({ ...prev, [task.id]: { ...comp, task_id: task.id } }))
      closeModal()
      setExpanded(null)
      showToast(
        mode === 'flag' ? '⚑ Issue flagged' : '✓ Task completed',
        mode === 'flag' ? 'error' : 'success'
      )
    } catch (err) {
      console.error(err)
      showToast('Something went wrong — try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  const completedCount = Object.keys(completions).length
  const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <>
      {/* Shift header */}
      <div style={{ background: 'var(--navy)', padding: '12px 16px 16px', flexShrink: 0 }}>
        <button onClick={onBack} style={{
          color: 'var(--aqua)', fontSize: 13, fontWeight: 600,
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer'
        }}>
          ‹ All shifts
        </button>
        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--white)' }}>{shift.name}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {completedCount} of {tasks.length} tasks completed
          {locationData && !locationData.onSite && locationData.latitude && (
            <span style={{ marginLeft: 8, color: '#FFB347' }}>· ⚠️ Off-site</span>
          )}
        </div>
        <div className="progress-bar" style={{ marginTop: 10, background: 'rgba(255,255,255,0.1)' }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Task list */}
      <div className="page-content" style={{ paddingTop: 12 }}>
        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No tasks assigned to this shift yet.</div>
          </div>
        ) : (
          tasks.map(task => {
            const comp = completions[task.id]
            const status = comp?.status || 'pending'
            const isExpanded = expanded === task.id

            return (
              <div key={task.id} className={`task-row ${status}`}>
                {/* Task header — always tappable */}
                <div
                  className="task-header"
                  onClick={() => !comp && setExpanded(isExpanded ? null : task.id)}
                  style={{ cursor: comp ? 'default' : 'pointer' }}
                >
                  <div className="task-dot" style={{ background: CAT_COLORS[task.category] || '#888' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`task-name ${status}`}>{task.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 5 }}>
                      <span className={`badge badge-${status}`}>
                        {status === 'pending' ? '○ Pending' : status === 'completed' ? '✓ Done' : '⚑ Flagged'}
                      </span>
                      <span className={`badge cat-${task.category}`} style={{ fontSize: 10 }}>
                        {CAT_LABELS[task.category]}
                      </span>
                    </div>
                    {comp?.comment && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{comp.comment}"
                      </div>
                    )}
                  </div>
                  {!comp && (
                    <span style={{
                      color: 'var(--text-light)', fontSize: 20, flexShrink: 0,
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s', display: 'block'
                    }}>›</span>
                  )}
                </div>

                {/* Expanded action area */}
                {isExpanded && !comp && (
                  <div className="task-actions">
                    {task.description && (
                      <div style={{
                        fontSize: 13, color: 'var(--text-secondary)',
                        lineHeight: 1.5, padding: '4px 0 8px'
                      }}>
                        {task.description}
                      </div>
                    )}
                    <div className="task-btn-row">
                      <button className="btn btn-success" onClick={() => openModal(task, 'complete')}>
                        ✓ Complete
                      </button>
                      <button className="btn btn-danger" onClick={() => openModal(task, 'flag')}>
                        ⚑ Flag Issue
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Complete / Flag modal */}
      {activeModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-title">
              {activeModal.mode === 'flag' ? '⚑ Flag an issue' : '✓ Complete task'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.4 }}>
              {activeModal.task.name}
            </div>

            <div className="form-group">
              <label className="form-label">
                {activeModal.mode === 'flag' ? 'Describe the issue' : 'Add a comment (optional)'}
              </label>
              <textarea className="form-input" rows={3}
                placeholder={activeModal.mode === 'flag' ? 'What is the issue? Where exactly?' : 'Any notes…'}
                value={comment} onChange={e => setComment(e.target.value)} />
            </div>

            {activeModal.mode === 'flag' && (
              <div className="form-group">
                <label className="form-label">Add photos (optional)</label>
                <input type="file" accept="image/*" multiple capture="environment"
                  ref={fileRef} style={{ display: 'none' }} onChange={handleImageAdd} />
                <div className="image-upload-area" onClick={() => fileRef.current?.click()}>
                  📷 Tap to take photo or choose from library
                </div>
                {images.length > 0 && (
                  <div className="image-preview-grid">
                    {images.map((img, i) => (
                      <img key={i} src={img.url} className="image-preview" alt="" />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={closeModal} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className={`btn ${activeModal.mode === 'flag' ? 'btn-danger' : 'btn-success'}`}
                onClick={handleSave} disabled={saving} style={{ flex: 2 }}
              >
                {saving ? 'Saving…' : activeModal.mode === 'flag' ? 'Submit Issue' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
