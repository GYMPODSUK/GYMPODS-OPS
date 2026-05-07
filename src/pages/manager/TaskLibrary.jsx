import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const CATEGORIES = [
  { value: 'cleaning',        label: 'Cleaning',        color: '#2A8A8E' },
  { value: 'health_safety',   label: 'Health & Safety', color: '#C07010' },
  { value: 'maintenance',     label: 'Maintenance',     color: '#5A4A9A' },
  { value: 'opening_closing', label: 'Opening/Closing', color: '#2A5A8E' },
  { value: 'other',           label: 'Other',           color: '#4A6A7A' },
]

const FREQUENCIES = [
  { value: 'session',     label: 'Every session' },
  { value: 'daily',       label: 'Daily' },
  { value: 'weekly',      label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly',     label: 'Monthly' },
  { value: 'quarterly',   label: 'Quarterly' },
  { value: 'yearly',      label: 'Yearly' },
]

const SCHEDULE_TYPES = [
  { value: 'any',                   label: 'Any day' },
  { value: 'specific_weekday',      label: 'Specific day of week' },
  { value: 'first_weekday_of_month',label: 'First weekday of month' },
  { value: 'specific_date',         label: 'Specific date of month' },
]

const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const ROLES = [
  { value: '',           label: 'Any staff' },
  { value: 'foh',        label: 'FOH and above' },
  { value: 'senior_foh', label: 'Senior FOH and above' },
  { value: 'admin',      label: 'Admin only' },
]

const FREQ_COLORS = {
  session: '#7FC0C3', daily: '#2A8A8E', weekly: '#5A4A9A',
  fortnightly: '#7A4A9A', monthly: '#C07010', quarterly: '#C04010', yearly: '#8A2020'
}

export default function TaskLibrary() {
  const { staff, isAdmin } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('all')
  const [filterFreq, setFilterFreq] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    name: '', description: '', category: 'cleaning', frequency: 'session',
    schedule_type: 'any', schedule_value: '', assigned_role: ''
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('task_library').select('*')
      .eq('site_id', staff.site_id)
      .order('category').order('name')
    setTasks(data || [])
    setLoading(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  const openAdd = () => {
    if (!isAdmin()) return
    setEditing(null)
    setForm({ name: '', description: '', category: 'cleaning', frequency: 'session', schedule_type: 'any', schedule_value: '', assigned_role: '' })
    setShowForm(true)
  }

  const openEdit = (task) => {
    if (!isAdmin()) return
    setEditing(task)
    setForm({
      name: task.name, description: task.description || '',
      category: task.category, frequency: task.frequency || 'session',
      schedule_type: task.schedule_type || 'any',
      schedule_value: task.schedule_value || '',
      assigned_role: task.assigned_role || ''
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Task name required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        frequency: form.frequency,
        schedule_type: form.schedule_type,
        schedule_value: form.schedule_value ? parseInt(form.schedule_value) : null,
        assigned_role: form.assigned_role || null,
      }
      if (editing) {
        await supabase.from('task_library').update(payload).eq('id', editing.id)
        showToast('Task updated')
      } else {
        await supabase.from('task_library').insert({ ...payload, site_id: staff.site_id })
        showToast('Task added')
      }
      setShowForm(false)
      loadData()
    } catch (err) {
      showToast('Error saving', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete "${task.name}"?`)) return
    await supabase.from('task_library').delete().eq('id', task.id)
    showToast('Task deleted')
    loadData()
  }

  const getCatColor = (cat) => CATEGORIES.find(c => c.value === cat)?.color || '#888'
  const getCatLabel = (cat) => CATEGORIES.find(c => c.value === cat)?.label || cat
  const getFreqLabel = (freq) => FREQUENCIES.find(f => f.value === freq)?.label || freq

  const scheduleNeedsValue = (type) => type === 'specific_weekday' || type === 'first_weekday_of_month' || type === 'specific_date'

  const filtered = tasks.filter(t => {
    if (filterCat !== 'all' && t.category !== filterCat) return false
    if (filterFreq !== 'all' && t.frequency !== filterFreq) return false
    return true
  })

  const isNonSession = (freq) => freq && freq !== 'session' && freq !== 'daily'

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>

  return (
    <>
      {/* Sticky header */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>Task Library</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{tasks.length} tasks</div>
          </div>
          {isAdmin() && (
            <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ width: 'auto' }}>
              + New task
            </button>
          )}
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
          <button onClick={() => setFilterCat('all')} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
            background: filterCat === 'all' ? 'var(--navy)' : 'var(--off-white)',
            color: filterCat === 'all' ? 'var(--white)' : 'var(--text-secondary)',
            border: `1px solid ${filterCat === 'all' ? 'var(--navy)' : 'var(--border)'}`,
          }}>All</button>
          {CATEGORIES.map(cat => {
            const count = tasks.filter(t => t.category === cat.value).length
            if (!count) return null
            return (
              <button key={cat.value} onClick={() => setFilterCat(cat.value)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
                background: filterCat === cat.value ? cat.color : 'var(--off-white)',
                color: filterCat === cat.value ? 'var(--white)' : 'var(--text-secondary)',
                border: `1px solid ${filterCat === cat.value ? cat.color : 'var(--border)'}`,
              }}>{cat.label} ({count})</button>
            )
          })}
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>

        {/* Non-session tasks section */}
        {filtered.filter(t => isNonSession(t.frequency)).length > 0 && (
          <>
            <div className="section-heading" style={{ marginTop: 4 }}>Scheduled tasks</div>
            {filtered.filter(t => isNonSession(t.frequency)).map(task => (
              <TaskCard key={task.id} task={task} getCatColor={getCatColor} getCatLabel={getCatLabel}
                getFreqLabel={getFreqLabel} isAdmin={isAdmin()} onEdit={openEdit} onDelete={handleDelete} />
            ))}
            <div className="section-heading" style={{ marginTop: 8 }}>Session / daily tasks</div>
          </>
        )}

        {filtered.filter(t => !isNonSession(t.frequency)).map(task => (
          <TaskCard key={task.id} task={task} getCatColor={getCatColor} getCatLabel={getCatLabel}
            getFreqLabel={getFreqLabel} isAdmin={isAdmin()} onEdit={openEdit} onDelete={handleDelete} />
        ))}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No tasks yet. Tap "+ New task" to add your first.</div>
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-sheet" style={{ maxHeight: '85vh' }}>
            <div className="modal-handle" />
            <div className="modal-title">{editing ? 'Edit Task' : 'New Task'}</div>

            <div className="form-group">
              <label className="form-label">Task name</label>
              <input className="form-input" placeholder="e.g. Sanitise POD after session"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea className="form-input" placeholder="Instructions or details for staff…"
                value={form.description} rows={2}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-select" value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value, schedule_type: 'any', schedule_value: '' }))}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>

            {/* Scheduling — only for weekly and above */}
            {['weekly','fortnightly','monthly','quarterly','yearly'].includes(form.frequency) && (
              <div className="form-group">
                <label className="form-label">Schedule</label>
                <select className="form-select" value={form.schedule_type}
                  onChange={e => setForm(f => ({ ...f, schedule_type: e.target.value, schedule_value: '' }))}>
                  {SCHEDULE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}

            {/* Schedule value */}
            {scheduleNeedsValue(form.schedule_type) && (
              <div className="form-group">
                <label className="form-label">
                  {form.schedule_type === 'specific_date' ? 'Day of month (1-31)' : 'Day of week'}
                </label>
                {form.schedule_type === 'specific_date' ? (
                  <input className="form-input" type="number" min="1" max="31"
                    placeholder="e.g. 1 for 1st of month"
                    value={form.schedule_value}
                    onChange={e => setForm(f => ({ ...f, schedule_value: e.target.value }))} />
                ) : (
                  <select className="form-select" value={form.schedule_value}
                    onChange={e => setForm(f => ({ ...f, schedule_value: e.target.value }))}>
                    <option value="">Select day…</option>
                    {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Assigned to</label>
              <select className="form-select" value={form.assigned_role}
                onChange={e => setForm(f => ({ ...f, assigned_role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

function TaskCard({ task, getCatColor, getCatLabel, getFreqLabel, isAdmin, onEdit, onDelete }) {
  const isScheduled = task.frequency && task.frequency !== 'session' && task.frequency !== 'daily'
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '14px',
      display: 'flex', alignItems: 'flex-start', gap: 12
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: getCatColor(task.category), marginTop: 3
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{task.name}</div>
        {task.description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
            {task.description}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          <span className={`badge cat-${task.category}`}>{getCatLabel(task.category)}</span>
          {isScheduled && (
            <span className="badge" style={{
              background: '#F0EEF8', color: '#5A4A9A'
            }}>{getFreqLabel(task.frequency)}</span>
          )}
          {task.assigned_role && (
            <span className="badge badge-pending">{task.assigned_role}</span>
          )}
        </div>
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-outline btn-sm" onClick={() => onEdit(task)}
            style={{ padding: '5px 10px', fontSize: 12 }}>Edit</button>
          <button onClick={() => onDelete(task)} style={{
            padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none',
            borderRadius: 'var(--radius-sm)'
          }}>Del</button>
        </div>
      )}
    </div>
  )
}
