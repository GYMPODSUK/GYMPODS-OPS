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
import { useT, useLanguage } from '../../lib/i18n'

// Panel wording in all five languages. The message TEXT people type is
// translated separately (DeepL — a later step); shift names stay as typed.
const TEXT = {
  en: {
    h_shift: 'Messages for this shift', h_me: 'Messages for you',
    h_manager: 'Team messages for you', h_all: 'Open team messages',
    just_now: 'just now', mins_ago: '{n}m ago', hrs_ago: '{n}h ago', days_ago: '{n}d ago',
    for_you: 'for you', for_person: 'for {name}', for_day_shift: 'for {day} · {shift}',
    for_next_shift: 'for next {shift} shift', for_managers: 'for managers', a_shift: 'a shift',
    message_for: 'Message {target}', from: 'From',
    mark_done: 'Mark done & clear', saving: 'Saving…', keep: 'Keep for now',
    clears_note: 'Marking done clears this message for everyone.',
    done_error: 'Could not mark this done — please try again', close: 'Close',
  },
  fr: {
    h_shift: 'Messages pour ce service', h_me: 'Messages pour vous',
    h_manager: "Messages d'équipe pour vous", h_all: "Messages d'équipe en cours",
    just_now: "à l'instant", mins_ago: 'il y a {n} min', hrs_ago: 'il y a {n} h', days_ago: 'il y a {n} j',
    for_you: 'pour vous', for_person: 'pour {name}', for_day_shift: 'pour {day} · {shift}',
    for_next_shift: 'pour le prochain service {shift}', for_managers: 'pour les responsables', a_shift: 'un service',
    message_for: 'Message {target}', from: 'De',
    mark_done: 'Marquer comme fait et effacer', saving: 'Enregistrement…', keep: "Garder pour l'instant",
    clears_note: 'Marquer comme fait efface ce message pour tout le monde.',
    done_error: 'Impossible de marquer comme fait — réessayez', close: 'Fermer',
  },
  es: {
    h_shift: 'Mensajes para este turno', h_me: 'Mensajes para ti',
    h_manager: 'Mensajes del equipo para ti', h_all: 'Mensajes del equipo abiertos',
    just_now: 'ahora mismo', mins_ago: 'hace {n} min', hrs_ago: 'hace {n} h', days_ago: 'hace {n} d',
    for_you: 'para ti', for_person: 'para {name}', for_day_shift: 'para {day} · {shift}',
    for_next_shift: 'para el próximo turno {shift}', for_managers: 'para los gerentes', a_shift: 'un turno',
    message_for: 'Mensaje {target}', from: 'De',
    mark_done: 'Marcar como hecho y borrar', saving: 'Guardando…', keep: 'Dejar por ahora',
    clears_note: 'Al marcarlo como hecho, el mensaje desaparece para todos.',
    done_error: 'No se ha podido marcar como hecho: inténtalo de nuevo', close: 'Cerrar',
  },
  it: {
    h_shift: 'Messaggi per questo turno', h_me: 'Messaggi per te',
    h_manager: 'Messaggi del team per te', h_all: 'Messaggi del team aperti',
    just_now: 'proprio ora', mins_ago: '{n} min fa', hrs_ago: '{n} h fa', days_ago: '{n} g fa',
    for_you: 'per te', for_person: 'per {name}', for_day_shift: 'per {day} · {shift}',
    for_next_shift: 'per il prossimo turno {shift}', for_managers: 'per i responsabili', a_shift: 'un turno',
    message_for: 'Messaggio {target}', from: 'Da',
    mark_done: 'Segna come fatto e rimuovi', saving: 'Salvataggio…', keep: 'Tieni per ora',
    clears_note: 'Segnandolo come fatto, il messaggio sparisce per tutti.',
    done_error: 'Impossibile segnare come fatto — riprova', close: 'Chiudi',
  },
  pt: {
    h_shift: 'Mensagens para este turno', h_me: 'Mensagens para si',
    h_manager: 'Mensagens da equipa para si', h_all: 'Mensagens da equipa em aberto',
    just_now: 'agora mesmo', mins_ago: 'há {n} min', hrs_ago: 'há {n} h', days_ago: 'há {n} d',
    for_you: 'para si', for_person: 'para {name}', for_day_shift: 'para {day} · {shift}',
    for_next_shift: 'para o próximo turno {shift}', for_managers: 'para os gestores', a_shift: 'um turno',
    message_for: 'Mensagem {target}', from: 'De',
    mark_done: 'Marcar como feito e limpar', saving: 'A guardar…', keep: 'Manter por agora',
    clears_note: 'Ao marcar como feito, a mensagem desaparece para todos.',
    done_error: 'Não foi possível marcar como feito — tente novamente', close: 'Fechar',
  },
}

export default function NotesPanel({ siteId, mode, shiftId }) {
  const { staff } = useAuth()
  const t = useT(TEXT)
  const { locale } = useLanguage()
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
      setError('done_error')
      return
    }
    setSelected(null)
    setNotes(prev => prev.filter(n => n.id !== id)) // instant; realtime reconciles
  }

  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (mins < 1) return t('just_now')
    if (mins < 60) return t('mins_ago', { n: mins })
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return t('hrs_ago', { n: hrs })
    return t('days_ago', { n: Math.floor(hrs / 24) })
  }
  const dayLabel = (ymd) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  }
  const fullWhen = (ts) => new Date(ts).toLocaleString(locale, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const personName = (p) => (p ? `${p.first_name} ${p.last_name}` : '—')

  // Who a message is for, e.g. "for you", "for Thu 26 Sep · Morning",
  // "for next Evening shift", "for Sarah Khan", "for managers".
  const targetLabel = (n) => {
    if (n.target_type === 'staff') {
      return n.target_staff_id === staff.id ? t('for_you') : t('for_person', { name: personName(n.target_staff) })
    }
    if (n.target_type === 'shift') {
      const name = n.shift?.name || t('a_shift')
      return n.target_date
        ? t('for_day_shift', { day: dayLabel(n.target_date), shift: name })
        : t('for_next_shift', { shift: name })
    }
    return t('for_managers')
  }

  const heading = '📌 ' + (mode === 'shift' ? t('h_shift')
    : mode === 'me' ? t('h_me')
    : mode === 'manager' ? t('h_manager')
    : t('h_all'))

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
                📌 {t('message_for', { target: targetLabel(selected) })}
              </div>
              <button onClick={() => setSelected(null)} aria-label={t('close')} disabled={busyId === selected.id} style={{
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
              {t('from')} <strong style={{ color: 'var(--text-primary)' }}>{personName(selected.author)}</strong>
              <br />{fullWhen(selected.created_at)} · {timeAgo(selected.created_at)}
            </div>

            {error && (
              <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{t(error)}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-success" disabled={busyId === selected.id}
                onClick={() => markDone(selected.id)}>
                {busyId === selected.id ? t('saving') : `✓ ${t('mark_done')}`}
              </button>
              <button className="btn btn-outline" disabled={busyId === selected.id}
                onClick={() => setSelected(null)}>{t('keep')}</button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-light)', textAlign: 'center', marginTop: 10 }}>
              {t('clears_note')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
