import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import NotesPanel from '../notes/NotesPanel'
import TaskImageStrip, { fetchTaskImages } from '../shared/TaskImages'
import { useT } from '../../lib/i18n'

const CAT_COLORS = {
  cleaning: '#2A8A8E', health_safety: '#C07010',
  maintenance: '#5A4A9A', opening_closing: '#2A5A8E', other: '#4A6A7A',
}

// Task screen wording in all five languages. Task NAMES and descriptions are
// written by managers, so they stay as typed for now (later task-content batch).
const TEXT = {
  en: {
    cat_cleaning: 'Cleaning', cat_health_safety: 'H&S', cat_maintenance: 'Maintenance',
    cat_opening_closing: 'Opening/Closing', cat_other: 'Other',
    all_shifts: 'All shifts', tasks_done: '{done} of {total} tasks completed', off_site: 'Off-site',
    no_tasks: 'No tasks assigned to this shift yet.',
    pending: 'Pending', done: 'Done', flagged: 'Flagged',
    complete: 'Complete', flag_issue: 'Flag Issue',
    title_flag: 'Flag an issue', title_complete: 'Complete task',
    describe_issue: 'Describe the issue', add_comment: 'Add a comment (optional)',
    ph_issue: 'What is the issue? Where exactly?', ph_comment: 'Any notes…',
    add_photos: 'Add photos (optional)', photo_tap: 'Tap to take photo or choose from library',
    cancel: 'Cancel', saving: 'Saving…', submit_issue: 'Submit Issue', mark_complete: 'Mark Complete',
    toast_flagged: 'Issue flagged', toast_done: 'Task completed', toast_error: 'Something went wrong — try again',
  },
  fr: {
    cat_cleaning: 'Nettoyage', cat_health_safety: 'Santé & sécurité', cat_maintenance: 'Maintenance',
    cat_opening_closing: 'Ouverture/Fermeture', cat_other: 'Autre',
    all_shifts: 'Tous les services', tasks_done: '{done} sur {total} tâches effectuées', off_site: 'Hors site',
    no_tasks: "Aucune tâche attribuée à ce service pour l'instant.",
    pending: 'À faire', done: 'Fait', flagged: 'Signalé',
    complete: 'Terminer', flag_issue: 'Signaler un problème',
    title_flag: 'Signaler un problème', title_complete: 'Terminer la tâche',
    describe_issue: 'Décrivez le problème', add_comment: 'Ajouter un commentaire (facultatif)',
    ph_issue: 'Quel est le problème ? Où exactement ?', ph_comment: 'Remarques…',
    add_photos: 'Ajouter des photos (facultatif)', photo_tap: 'Touchez pour prendre une photo ou choisir dans la galerie',
    cancel: 'Annuler', saving: 'Enregistrement…', submit_issue: 'Envoyer le signalement', mark_complete: 'Marquer comme terminé',
    toast_flagged: 'Problème signalé', toast_done: 'Tâche terminée', toast_error: 'Une erreur est survenue — réessayez',
  },
  es: {
    cat_cleaning: 'Limpieza', cat_health_safety: 'Seguridad y salud', cat_maintenance: 'Mantenimiento',
    cat_opening_closing: 'Apertura/Cierre', cat_other: 'Otro',
    all_shifts: 'Todos los turnos', tasks_done: '{done} de {total} tareas completadas', off_site: 'Fuera del centro',
    no_tasks: 'Todavía no hay tareas asignadas a este turno.',
    pending: 'Pendiente', done: 'Hecho', flagged: 'Incidencia',
    complete: 'Completar', flag_issue: 'Informar de un problema',
    title_flag: 'Informar de un problema', title_complete: 'Completar tarea',
    describe_issue: 'Describe el problema', add_comment: 'Añade un comentario (opcional)',
    ph_issue: '¿Cuál es el problema? ¿Dónde exactamente?', ph_comment: 'Notas…',
    add_photos: 'Añade fotos (opcional)', photo_tap: 'Toca para hacer una foto o elegir de la galería',
    cancel: 'Cancelar', saving: 'Guardando…', submit_issue: 'Enviar problema', mark_complete: 'Marcar como hecha',
    toast_flagged: 'Problema informado', toast_done: 'Tarea completada', toast_error: 'Algo ha fallado: inténtalo de nuevo',
  },
  it: {
    cat_cleaning: 'Pulizia', cat_health_safety: 'Salute e sicurezza', cat_maintenance: 'Manutenzione',
    cat_opening_closing: 'Apertura/Chiusura', cat_other: 'Altro',
    all_shifts: 'Tutti i turni', tasks_done: '{done} di {total} compiti completati', off_site: 'Fuori sede',
    no_tasks: 'Nessun compito ancora assegnato a questo turno.',
    pending: 'Da fare', done: 'Fatto', flagged: 'Segnalato',
    complete: 'Completa', flag_issue: 'Segnala un problema',
    title_flag: 'Segnala un problema', title_complete: 'Completa il compito',
    describe_issue: 'Descrivi il problema', add_comment: 'Aggiungi un commento (facoltativo)',
    ph_issue: 'Qual è il problema? Dove esattamente?', ph_comment: 'Note…',
    add_photos: 'Aggiungi foto (facoltativo)', photo_tap: 'Tocca per scattare una foto o scegliere dalla galleria',
    cancel: 'Annulla', saving: 'Salvataggio…', submit_issue: 'Invia segnalazione', mark_complete: 'Segna come completato',
    toast_flagged: 'Problema segnalato', toast_done: 'Compito completato', toast_error: 'Qualcosa è andato storto — riprova',
  },
  pt: {
    cat_cleaning: 'Limpeza', cat_health_safety: 'Saúde e segurança', cat_maintenance: 'Manutenção',
    cat_opening_closing: 'Abertura/Fecho', cat_other: 'Outro',
    all_shifts: 'Todos os turnos', tasks_done: '{done} de {total} tarefas concluídas', off_site: 'Fora do local',
    no_tasks: 'Ainda não há tarefas atribuídas a este turno.',
    pending: 'Pendente', done: 'Feito', flagged: 'Assinalado',
    complete: 'Concluir', flag_issue: 'Assinalar problema',
    title_flag: 'Assinalar um problema', title_complete: 'Concluir tarefa',
    describe_issue: 'Descreva o problema', add_comment: 'Adicione um comentário (opcional)',
    ph_issue: 'Qual é o problema? Onde exatamente?', ph_comment: 'Notas…',
    add_photos: 'Adicione fotografias (opcional)', photo_tap: 'Toque para tirar uma fotografia ou escolher da galeria',
    cancel: 'Cancelar', saving: 'A guardar…', submit_issue: 'Enviar problema', mark_complete: 'Marcar como concluída',
    toast_flagged: 'Problema assinalado', toast_done: 'Tarefa concluída', toast_error: 'Algo correu mal — tente novamente',
  },
}

export default function ShiftTasks({ shift, locationData, onBack }) {
  const { staff } = useAuth()
  const t = useT(TEXT)
  const [tasks, setTasks] = useState([])
  const [taskImages, setTaskImages] = useState({})
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
    let list = taskData?.map(row => row.task_library).filter(Boolean) || []
    // Exact-role filter: a task with roles set only shows to staff in that
    // set (e.g. a Trainee-only task never shows to FOH, even though FOH
    // outranks Trainee — this isn't a hierarchy). Empty roles = any staff.
    // A manager covering a shift sees every task, regardless of role, so
    // nothing gets missed while they're standing in.
    const isCoveringManager = ['admin', 'region_manager', 'hq'].includes(staff.role)
    if (!isCoveringManager) {
      list = list.filter(task => !task.assigned_roles?.length || task.assigned_roles.includes(staff.role))
    }
    setTasks(list)
    // Reference photos the manager attached in the Task Library.
    setTaskImages(await fetchTaskImages(list.map(task => task.id)))

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
        mode === 'flag' ? `⚑ ${t('toast_flagged')}` : `✓ ${t('toast_done')}`,
        mode === 'flag' ? 'error' : 'success'
      )
    } catch (err) {
      console.error(err)
      showToast(t('toast_error'), 'error')
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
          ‹ {t('all_shifts')}
        </button>
        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--white)' }}>{shift.name}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {t('tasks_done', { done: completedCount, total: tasks.length })}
          {locationData && !locationData.onSite && locationData.latitude && (
            <span style={{ marginLeft: 8, color: '#FFB347' }}>· ⚠️ {t('off_site')}</span>
          )}
        </div>
        <div className="progress-bar" style={{ marginTop: 10, background: 'rgba(255,255,255,0.1)' }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Task list */}
      <div className="page-content" style={{ paddingTop: 12 }}>
        <NotesPanel siteId={staff.site_id} mode="shift" shiftId={shift.id} shiftName={shift.name} />
        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">{t('no_tasks')}</div>
          </div>
        ) : (
          tasks.map(task => {
            const comp = completions[task.id]
            const status = comp?.status || 'pending'
            const isExpanded = expanded === task.id
            const refImages = taskImages[task.id] || []

            return (
              <div key={task.id} className={`task-row ${status}`}>
                {/* Task header — always tappable */}
                <div
                  className="task-header"
                  onClick={() => setExpanded(isExpanded ? null : task.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="task-dot" style={{ background: CAT_COLORS[task.category] || '#888' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`task-name ${status}`}>{task.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 5 }}>
                      <span className={`badge badge-${status}`}>
                        {status === 'pending' ? `○ ${t('pending')}` : status === 'completed' ? `✓ ${t('done')}` : `⚑ ${t('flagged')}`}
                      </span>
                      <span className={`badge cat-${task.category}`} style={{ fontSize: 10 }}>
                        {t(`cat_${task.category}`)}
                      </span>
                      {refImages.length > 0 && (
                        <span className="badge" style={{
                          fontSize: 10, background: 'var(--aqua-light)', color: 'var(--navy)',
                        }}>📷 {refImages.length}</span>
                      )}
                    </div>
                    {comp?.comment && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{comp.comment}"
                      </div>
                    )}
                  </div>
                  <span style={{
                    color: 'var(--text-light)', fontSize: 20, flexShrink: 0,
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s', display: 'block'
                  }}>›</span>
                </div>

                {/* Expanded action area */}
                {isExpanded && (
                  <div className="task-actions">
                    {task.description && (
                      <div style={{
                        fontSize: 13, color: 'var(--text-secondary)',
                        lineHeight: 1.5, padding: '4px 0 8px'
                      }}>
                        {task.description}
                      </div>
                    )}

                    {refImages.length > 0 && (
                      <div style={{ padding: '4px 0 12px' }}>
                        <TaskImageStrip images={refImages} size={64} showLabel />
                      </div>
                    )}

                    {!comp && (
                      <div className="task-btn-row">
                        <button className="btn btn-success" onClick={() => openModal(task, 'complete')}>
                          ✓ {t('complete')}
                        </button>
                        <button className="btn btn-danger" onClick={() => openModal(task, 'flag')}>
                          ⚑ {t('flag_issue')}
                        </button>
                      </div>
                    )}
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
              {activeModal.mode === 'flag' ? `⚑ ${t('title_flag')}` : `✓ ${t('title_complete')}`}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.4 }}>
              {activeModal.task.name}
            </div>

            <div className="form-group">
              <label className="form-label">
                {activeModal.mode === 'flag' ? t('describe_issue') : t('add_comment')}
              </label>
              <textarea className="form-input" rows={3}
                placeholder={activeModal.mode === 'flag' ? t('ph_issue') : t('ph_comment')}
                value={comment} onChange={e => setComment(e.target.value)} />
            </div>

            {activeModal.mode === 'flag' && (
              <div className="form-group">
                <label className="form-label">{t('add_photos')}</label>
                <input type="file" accept="image/*" multiple capture="environment"
                  ref={fileRef} style={{ display: 'none' }} onChange={handleImageAdd} />
                <div className="image-upload-area" onClick={() => fileRef.current?.click()}>
                  📷 {t('photo_tap')}
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
                {t('cancel')}
              </button>
              <button
                className={`btn ${activeModal.mode === 'flag' ? 'btn-danger' : 'btn-success'}`}
                onClick={handleSave} disabled={saving} style={{ flex: 2 }}
              >
                {saving ? t('saving') : activeModal.mode === 'flag' ? t('submit_issue') : t('mark_complete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
