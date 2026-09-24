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
import { useT, useLanguage } from '../../../lib/i18n'

const TYPE_OPTIONS = [
  { value: 'general',     icon: '💬' },
  { value: 'member_note', icon: '👤' },
  { value: 'photo',       icon: '📷' },
]

const PRIORITY_OPTIONS = [
  { value: 'urgent', icon: '🔴' },
  { value: 'normal', icon: '🟡' },
  { value: 'fyi',    icon: '⚪' },
]

const DAYS_AHEAD = 7

// Compose wording in all five languages. Shift names and people's names
// stay as they are; the message text itself is translated later (DeepL).
const TEXT = {
  en: {
    new_message: 'New message', msg_team: 'Message team members', msg_managers: 'Message managers',
    whos_for: "Who's it for?", change: 'Change', cancel: 'Cancel',
    team_hint: "For a shift this week or a team member. Stays on their screen until it's done.",
    managers_hint: 'Member notes, general messages and photos for the management team.',
    send_to: 'Send to', a_shift: 'A shift', a_member: 'A team member',
    which_shift: 'Which shift', choose_shift: 'Choose a shift…', next_group: 'Next shift (whichever day)',
    next_option: 'Next {shift} shift', today: 'Today', no_shifts: 'No shifts set up at this gym yet.',
    which_member: 'Which team member', choose_member: 'Choose a team member…',
    on_this_week: 'On this week', everyone_else: 'Everyone else', team: 'Team',
    message: 'Message', message_ph: 'e.g. Delivery due tomorrow AM — please receive it',
    title: 'Title', title_ph: 'Brief summary…', type: 'Type', priority: 'Priority',
    type_general: 'General', type_member_note: 'Member note', type_photo: 'Photo',
    pri_urgent: 'Urgent', pri_normal: 'Normal', pri_fyi: 'FYI',
    hint_urgent: 'Managers are notified immediately', hint_normal: 'Appears in the day-to-day feed',
    hint_fyi: 'Low priority — logged for reference',
    description: 'Description (optional)', description_ph: 'Add more detail…',
    photos: 'Photos (optional)', photo_tap: 'Tap to take photo or choose from library',
    err_title: 'Please add a title', err_body: 'Please write your message',
    err_shift: 'Choose which shift this is for', err_member: 'Choose who this is for',
    err_generic: 'Something went wrong — please try again',
    sending: 'Sending…', send_managers: 'Send to managers', send_team: 'Send to team',
  },
  fr: {
    new_message: 'Nouveau message', msg_team: "Message aux membres de l'équipe", msg_managers: 'Message aux responsables',
    whos_for: "À qui s'adresse-t-il ?", change: 'Modifier', cancel: 'Annuler',
    team_hint: "Pour un service de la semaine ou un membre de l'équipe. Reste affiché jusqu'à ce qu'il soit traité.",
    managers_hint: "Notes sur les membres, messages généraux et photos pour l'équipe de direction.",
    send_to: 'Envoyer à', a_shift: 'Un service', a_member: "Un membre de l'équipe",
    which_shift: 'Quel service', choose_shift: 'Choisissez un service…', next_group: 'Prochain service (quel que soit le jour)',
    next_option: 'Prochain service {shift}', today: "Aujourd'hui", no_shifts: "Aucun service n'est encore configuré dans cette salle.",
    which_member: "Quel membre de l'équipe", choose_member: "Choisissez un membre de l'équipe…",
    on_this_week: 'Présents cette semaine', everyone_else: 'Tous les autres', team: 'Équipe',
    message: 'Message', message_ph: 'ex. Livraison prévue demain matin — merci de la réceptionner',
    title: 'Titre', title_ph: 'Bref résumé…', type: 'Type', priority: 'Priorité',
    type_general: 'Général', type_member_note: 'Note sur un membre', type_photo: 'Photo',
    pri_urgent: 'Urgent', pri_normal: 'Normal', pri_fyi: 'Pour info',
    hint_urgent: 'Les responsables sont prévenus immédiatement', hint_normal: 'Apparaît dans le fil quotidien',
    hint_fyi: 'Faible priorité — enregistré pour référence',
    description: 'Description (facultatif)', description_ph: 'Ajoutez des détails…',
    photos: 'Photos (facultatif)', photo_tap: 'Touchez pour prendre une photo ou choisir dans la galerie',
    err_title: 'Veuillez ajouter un titre', err_body: 'Veuillez écrire votre message',
    err_shift: 'Choisissez le service concerné', err_member: 'Choisissez le destinataire',
    err_generic: 'Une erreur est survenue — veuillez réessayer',
    sending: 'Envoi…', send_managers: 'Envoyer aux responsables', send_team: "Envoyer à l'équipe",
  },
  es: {
    new_message: 'Nuevo mensaje', msg_team: 'Mensaje al equipo', msg_managers: 'Mensaje a los gerentes',
    whos_for: '¿Para quién es?', change: 'Cambiar', cancel: 'Cancelar',
    team_hint: 'Para un turno de esta semana o un miembro del equipo. Se queda en su pantalla hasta que esté hecho.',
    managers_hint: 'Notas sobre socios, mensajes generales y fotos para el equipo de gerencia.',
    send_to: 'Enviar a', a_shift: 'Un turno', a_member: 'Un miembro del equipo',
    which_shift: 'Qué turno', choose_shift: 'Elige un turno…', next_group: 'Próximo turno (cualquier día)',
    next_option: 'Próximo turno {shift}', today: 'Hoy', no_shifts: 'Todavía no hay turnos configurados en este gimnasio.',
    which_member: 'Qué miembro del equipo', choose_member: 'Elige un miembro del equipo…',
    on_this_week: 'Esta semana', everyone_else: 'Todos los demás', team: 'Equipo',
    message: 'Mensaje', message_ph: 'p. ej. Llega un pedido mañana por la mañana; por favor, recíbelo',
    title: 'Título', title_ph: 'Resumen breve…', type: 'Tipo', priority: 'Prioridad',
    type_general: 'General', type_member_note: 'Nota sobre un socio', type_photo: 'Foto',
    pri_urgent: 'Urgente', pri_normal: 'Normal', pri_fyi: 'Para información',
    hint_urgent: 'Se avisa a los gerentes de inmediato', hint_normal: 'Aparece en el día a día',
    hint_fyi: 'Prioridad baja: se guarda como referencia',
    description: 'Descripción (opcional)', description_ph: 'Añade más detalles…',
    photos: 'Fotos (opcional)', photo_tap: 'Toca para hacer una foto o elegir de la galería',
    err_title: 'Añade un título', err_body: 'Escribe tu mensaje',
    err_shift: 'Elige para qué turno es', err_member: 'Elige para quién es',
    err_generic: 'Algo ha fallado: inténtalo de nuevo',
    sending: 'Enviando…', send_managers: 'Enviar a los gerentes', send_team: 'Enviar al equipo',
  },
  it: {
    new_message: 'Nuovo messaggio', msg_team: 'Messaggio ai membri del team', msg_managers: 'Messaggio ai responsabili',
    whos_for: 'Per chi è?', change: 'Cambia', cancel: 'Annulla',
    team_hint: 'Per un turno di questa settimana o un membro del team. Resta sul suo schermo finché non è fatto.',
    managers_hint: 'Note sui clienti, messaggi generali e foto per i responsabili.',
    send_to: 'Invia a', a_shift: 'Un turno', a_member: 'Un membro del team',
    which_shift: 'Quale turno', choose_shift: 'Scegli un turno…', next_group: 'Prossimo turno (qualsiasi giorno)',
    next_option: 'Prossimo turno {shift}', today: 'Oggi', no_shifts: 'Nessun turno ancora impostato in questa palestra.',
    which_member: 'Quale membro del team', choose_member: 'Scegli un membro del team…',
    on_this_week: 'In servizio questa settimana', everyone_else: 'Tutti gli altri', team: 'Team',
    message: 'Messaggio', message_ph: 'es. Consegna prevista domani mattina — per favore ricevila',
    title: 'Titolo', title_ph: 'Breve riepilogo…', type: 'Tipo', priority: 'Priorità',
    type_general: 'Generale', type_member_note: 'Nota su un cliente', type_photo: 'Foto',
    pri_urgent: 'Urgente', pri_normal: 'Normale', pri_fyi: 'Per info',
    hint_urgent: 'I responsabili vengono avvisati subito', hint_normal: 'Appare nel flusso quotidiano',
    hint_fyi: 'Bassa priorità — registrato come riferimento',
    description: 'Descrizione (facoltativa)', description_ph: 'Aggiungi dettagli…',
    photos: 'Foto (facoltative)', photo_tap: 'Tocca per scattare una foto o scegliere dalla galleria',
    err_title: 'Aggiungi un titolo', err_body: 'Scrivi il tuo messaggio',
    err_shift: 'Scegli per quale turno è', err_member: 'Scegli per chi è',
    err_generic: 'Qualcosa è andato storto — riprova',
    sending: 'Invio…', send_managers: 'Invia ai responsabili', send_team: 'Invia al team',
  },
  pt: {
    new_message: 'Nova mensagem', msg_team: 'Mensagem para a equipa', msg_managers: 'Mensagem para os gestores',
    whos_for: 'Para quem é?', change: 'Alterar', cancel: 'Cancelar',
    team_hint: 'Para um turno desta semana ou um membro da equipa. Fica no ecrã até estar feito.',
    managers_hint: 'Notas sobre sócios, mensagens gerais e fotografias para a equipa de gestão.',
    send_to: 'Enviar para', a_shift: 'Um turno', a_member: 'Um membro da equipa',
    which_shift: 'Que turno', choose_shift: 'Escolha um turno…', next_group: 'Próximo turno (qualquer dia)',
    next_option: 'Próximo turno {shift}', today: 'Hoje', no_shifts: 'Ainda não há turnos configurados neste ginásio.',
    which_member: 'Que membro da equipa', choose_member: 'Escolha um membro da equipa…',
    on_this_week: 'Esta semana', everyone_else: 'Todos os outros', team: 'Equipa',
    message: 'Mensagem', message_ph: 'ex. Entrega prevista amanhã de manhã — por favor, receba-a',
    title: 'Título', title_ph: 'Breve resumo…', type: 'Tipo', priority: 'Prioridade',
    type_general: 'Geral', type_member_note: 'Nota sobre um sócio', type_photo: 'Fotografia',
    pri_urgent: 'Urgente', pri_normal: 'Normal', pri_fyi: 'Para informação',
    hint_urgent: 'Os gestores são avisados de imediato', hint_normal: 'Aparece no feed do dia a dia',
    hint_fyi: 'Prioridade baixa — registado para referência',
    description: 'Descrição (opcional)', description_ph: 'Acrescente mais detalhes…',
    photos: 'Fotografias (opcional)', photo_tap: 'Toque para tirar uma fotografia ou escolher da galeria',
    err_title: 'Adicione um título', err_body: 'Escreva a sua mensagem',
    err_shift: 'Escolha para que turno é', err_member: 'Escolha para quem é',
    err_generic: 'Algo correu mal — tente novamente',
    sending: 'A enviar…', send_managers: 'Enviar para os gestores', send_team: 'Enviar para a equipa',
  },
}

export default function ComposeMessage({ onClose, onSent }) {
  const { staff } = useAuth()
  const t = useT(TEXT)
  const { locale } = useLanguage()
  // "Thu 26 Sep" in the chosen language
  const dayLabel = (d) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
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
    if (!title.trim()) { setError('err_title'); return }
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
      setError('err_generic')
    } finally {
      setSaving(false)
    }
  }

  const sendToTeam = async () => {
    if (!noteBody.trim()) { setError('err_body'); return }
    if (teamTarget === 'shift' && !shiftChoice) { setError('err_shift'); return }
    if (teamTarget === 'staff' && !staffChoice) { setError('err_member'); return }
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
      setError('err_generic')
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

  const heading = audience === 'manager' ? `📨 ${t('msg_managers')}`
    : audience === 'team' ? `👥 ${t('msg_team')}`
    : t('new_message')

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
            }}>‹ {t('change')}</button>
          )}
        </div>

        {/* ── Step 1: who is it for? ── */}
        {!audience && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>{t('whos_for')}</div>
            <AudienceCard value="team" icon="👥" label={t('msg_team')} hint={t('team_hint')} />
            <AudienceCard value="manager" icon="📨" label={t('msg_managers')} hint={t('managers_hint')} />
            <button className="btn btn-outline btn-sm" onClick={onClose} style={{ width: '100%', marginTop: 4 }}>{t('cancel')}</button>
          </>
        )}

        {/* ── Team members route ── */}
        {audience === 'team' && (
          <>
            <div className="form-group">
              <label className="form-label">{t('send_to')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <ToggleBtn active={teamTarget === 'shift'} onClick={() => setTeamTarget('shift')}>{t('a_shift')}</ToggleBtn>
                <ToggleBtn active={teamTarget === 'staff'} onClick={() => setTeamTarget('staff')}>{t('a_member')}</ToggleBtn>
              </div>
            </div>

            {loadingTeam ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><div className="spinner" /></div>
            ) : teamTarget === 'shift' ? (
              <div className="form-group">
                <label className="form-label">{t('which_shift')}</label>
                <select className="form-input" value={shiftChoice} onChange={e => setShiftChoice(e.target.value)}>
                  <option value="">{t('choose_shift')}</option>
                  {shifts.length > 0 && (
                    <optgroup label={t('next_group')}>
                      {shifts.map(s => <option key={`next-${s.id}`} value={`${s.id}|`}>{t('next_option', { shift: s.name })}</option>)}
                    </optgroup>
                  )}
                  {upcomingDays.map((day, i) => (
                    <optgroup key={day.key} label={i === 0 ? `${t('today')} · ${dayLabel(day.date)}` : dayLabel(day.date)}>
                      {day.shifts.map(s => (
                        <option key={`${day.key}-${s.id}`} value={`${s.id}|${day.key}`}>
                          {dayLabel(day.date)} · {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {shifts.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{t('no_shifts')}</div>
                )}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">{t('which_member')}</label>
                <select className="form-input" value={staffChoice} onChange={e => setStaffChoice(e.target.value)}>
                  <option value="">{t('choose_member')}</option>
                  {team.recent.length > 0 && (
                    <optgroup label={t('on_this_week')}>
                      {team.recent.map(s => <option key={s.id} value={s.id}>{personName(s)}</option>)}
                    </optgroup>
                  )}
                  {team.others.length > 0 && (
                    <optgroup label={team.recent.length ? t('everyone_else') : t('team')}>
                      {team.others.map(s => <option key={s.id} value={s.id}>{personName(s)}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{t('message')}</label>
              <textarea className="form-input" rows={4}
                placeholder={t('message_ph')}
                value={noteBody} onChange={e => setNoteBody(e.target.value)} />
            </div>
          </>
        )}

        {/* ── Managers route (same as before, minus Handover) ── */}
        {audience === 'manager' && (
          <>
            <div className="form-group">
              <label className="form-label">{t('title')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" placeholder={t('title_ph')}
                value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">{t('type')}</label>
                <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {t(`type_${o.value}`)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('priority')}</label>
                <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {t(`pri_${o.value}`)}</option>)}
                </select>
              </div>
            </div>

            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', marginTop: -4, marginBottom: 14,
              padding: '6px 10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)'
            }}>
              {t(`hint_${priority}`)}
            </div>

            <div className="form-group">
              <label className="form-label">{t('description')}</label>
              <textarea className="form-input" rows={3} placeholder={t('description_ph')}
                value={body} onChange={e => setBody(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">{t('photos')}</label>
              <input type="file" accept="image/*" multiple capture="environment"
                ref={fileRef} style={{ display: 'none' }} onChange={handleImageAdd} />
              <div className="image-upload-area" onClick={() => fileRef.current?.click()}>
                📷 {t('photo_tap')}
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
          }}>{t(error)}</div>
        )}

        {audience && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={onClose} style={{ flex: 1 }} disabled={saving}>{t('cancel')}</button>
            {audience === 'manager' ? (
              <button className="btn btn-primary" onClick={sendToManagers}
                disabled={saving || !title.trim()} style={{ flex: 2 }}>
                {saving ? t('sending') : t('send_managers')}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={sendToTeam}
                disabled={saving || loadingTeam || !noteBody.trim()} style={{ flex: 2 }}>
                {saving ? t('sending') : t('send_team')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
