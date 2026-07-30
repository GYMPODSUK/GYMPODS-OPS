// src/pages/hq/SiteTasksModal.jsx
// Drill-down: for one site, today's shifts and every task under them,
// marked done / flagged / outstanding. Opened from the Network cards.
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { shiftsRunningOn } from '../../lib/schedule'

const STATUS_META = {
  completed:   { icon: '✓', label: 'Done',        color: 'var(--success)' },
  flagged:     { icon: '⚑', label: 'Flagged',     color: 'var(--danger)'  },
  outstanding: { icon: '○', label: 'Outstanding', color: 'var(--text-light)' },
}

export default function SiteTasksModal({ site, onClose }) {
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts]   = useState([])
  const today    = new Date().toISOString().split('T')[0]

  useEffect(() => { load() /* eslint-disable-next-line */ }, [site.id])

  const load = async () => {
    setLoading(true)
    const { data: defs } = await supabase
      .from('shift_definitions').select('*').eq('site_id', site.id).order('order_index')

    // Shifts that run today — shared helper, so this and the Network/Home
    // tallies can never drift apart again.
    const todays = shiftsRunningOn(defs)
    const shiftIds = todays.map(s => s.id)

    let taskRows = [], comps = []
    if (shiftIds.length) {
      const [{ data: tr }, { data: cp }] = await Promise.all([
        supabase.from('shift_tasks')
          .select('shift_id, order_index, task_library(id, name, category)')
          .in('shift_id', shiftIds).order('order_index'),
        supabase.from('task_completions')
          .select('shift_id, task_id, status')
          .eq('site_id', site.id).eq('date', today).in('shift_id', shiftIds),
      ])
      taskRows = tr || []; comps = cp || []
    }

    const compMap = {}
    comps.forEach(c => { compMap[`${c.shift_id}:${c.task_id}`] = c.status })

    setShifts(todays.map(s => ({
      shift: s,
      tasks: taskRows
        .filter(t => t.shift_id === s.id && t.task_library)
        .map(t => ({ task: t.task_library, status: compMap[`${s.id}:${t.task_library.id}`] || 'outstanding' })),
    })))
    setLoading(false)
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>{site.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Today's tasks · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'var(--off-white)', border: 'none', borderRadius: '50%', width: 30, height: 30,
            fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>
        ) : shifts.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">No shifts scheduled today.</div></div>
        ) : (
          shifts.map(({ shift, tasks }) => {
            const done = tasks.filter(t => t.status === 'completed').length
            const outstanding = tasks.filter(t => t.status === 'outstanding').length
            return (
              <div key={shift.id} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--navy)' }}>{shift.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {done}/{tasks.length} done{outstanding > 0 && ` · ${outstanding} left`}
                  </div>
                </div>
                {tasks.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-light)', padding: '4px 0' }}>No tasks assigned.</div>
                ) : (
                  tasks.map(({ task, status }) => {
                    const m = STATUS_META[status] || STATUS_META.outstanding
                    return (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6,
                        background: 'var(--off-white)', borderRadius: 'var(--radius-sm)',
                        opacity: status === 'outstanding' ? 1 : 0.85,
                      }}>
                        <span style={{ color: m.color, fontWeight: 800, fontSize: 15, width: 16, textAlign: 'center', flexShrink: 0 }}>{m.icon}</span>
                        <span style={{
                          flex: 1, fontSize: 13, color: 'var(--text-primary)',
                          textDecoration: status === 'completed' ? 'line-through' : 'none',
                        }}>{task.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: m.color, flexShrink: 0 }}>{m.label}</span>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
