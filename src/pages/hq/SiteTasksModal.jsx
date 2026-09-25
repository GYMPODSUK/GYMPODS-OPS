// src/pages/hq/SiteTasksModal.jsx
// Drill-down: for one site, today's shifts and every task under them,
// marked done / flagged / outstanding. Opened from the Network cards.
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { shiftsRunningOn } from '../../lib/schedule'
import { useT, useLanguage } from '../../lib/i18n'
import { translateText } from '../../lib/translate'

const STATUS_META = {
  completed:   { icon: '✓', color: 'var(--success)' },
  flagged:     { icon: '⚑', color: 'var(--danger)'  },
  outstanding: { icon: '○', color: 'var(--text-light)' },
}

// Wording in all five languages; shift and task names are translated live.
const TEXT = {
  en: { todays_tasks: "Today's tasks", no_shifts: 'No shifts scheduled today.', no_tasks: 'No tasks assigned.',
        done_of: '{done}/{total} done', left: ' · {n} left', close: 'Close',
        completed: 'Done', flagged: 'Flagged', outstanding: 'Outstanding' },
  fr: { todays_tasks: 'Tâches du jour', no_shifts: "Aucun service prévu aujourd'hui.", no_tasks: 'Aucune tâche attribuée.',
        done_of: '{done}/{total} faites', left: ' · {n} restantes', close: 'Fermer',
        completed: 'Fait', flagged: 'Signalé', outstanding: 'À faire' },
  es: { todays_tasks: 'Tareas de hoy', no_shifts: 'No hay turnos programados hoy.', no_tasks: 'Sin tareas asignadas.',
        done_of: '{done}/{total} hechas', left: ' · quedan {n}', close: 'Cerrar',
        completed: 'Hecho', flagged: 'Incidencia', outstanding: 'Pendiente' },
  it: { todays_tasks: 'Compiti di oggi', no_shifts: 'Nessun turno previsto oggi.', no_tasks: 'Nessun compito assegnato.',
        done_of: '{done}/{total} fatti', left: ' · {n} da fare', close: 'Chiudi',
        completed: 'Fatto', flagged: 'Segnalato', outstanding: 'Da fare' },
  pt: { todays_tasks: 'Tarefas de hoje', no_shifts: 'Não há turnos agendados hoje.', no_tasks: 'Nenhuma tarefa atribuída.',
        done_of: '{done}/{total} feitas', left: ' · faltam {n}', close: 'Fechar',
        completed: 'Feito', flagged: 'Assinalado', outstanding: 'Por fazer' },
}

export default function SiteTasksModal({ site, onClose }) {
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts]   = useState([])
  const t = useT(TEXT)
  const { lang, locale } = useLanguage()
  const [tx, setTx] = useState({})
  const tr = (x) => (x && tx[x]) || x
  const today    = new Date().toISOString().split('T')[0]

  useEffect(() => { load() /* eslint-disable-next-line */ }, [site.id])

  // Shift + task names are typed in English — translate for other languages.
  useEffect(() => {
    if (lang === 'en') { setTx({}); return }
    const texts = [...new Set(shifts.flatMap(({ shift, tasks }) => [shift.name, ...tasks.map(x => x.task.name)])
      .filter(x => x && x.trim()))]
    if (texts.length === 0) return
    let alive = true
    Promise.all(texts.map(x => translateText(x, lang).then(r => [x, r?.text])))
      .then(pairs => { if (alive) setTx(Object.fromEntries(pairs.filter(([, v]) => v))) })
    return () => { alive = false }
  }, [lang, shifts])

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
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('todays_tasks')} · {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          <button onClick={onClose} aria-label={t('close')} style={{
            background: 'var(--off-white)', border: 'none', borderRadius: '50%', width: 30, height: 30,
            fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>
        ) : shifts.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">{t('no_shifts')}</div></div>
        ) : (
          shifts.map(({ shift, tasks }) => {
            const done = tasks.filter(t => t.status === 'completed').length
            const outstanding = tasks.filter(t => t.status === 'outstanding').length
            return (
              <div key={shift.id} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--navy)' }}>{tr(shift.name)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {t('done_of', { done, total: tasks.length })}{outstanding > 0 && t('left', { n: outstanding })}
                  </div>
                </div>
                {tasks.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-light)', padding: '4px 0' }}>{t('no_tasks')}</div>
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
                        }}>{tr(task.name)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: m.color, flexShrink: 0 }}>{t(STATUS_META[status] ? status : 'outstanding')}</span>
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
