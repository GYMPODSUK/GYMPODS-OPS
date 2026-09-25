// src/pages/manager/Messages.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import NotesPanel from '../notes/NotesPanel'
import { TranslatedText } from '../../lib/translate'
import { useT, useLanguage } from '../../lib/i18n'

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#E8301A', bg: 'rgba(232,48,26,0.06)', dot: '#E8301A', border: 'rgba(232,48,26,0.2)' },
  normal: { label: 'Normal', color: 'var(--text-primary)', bg: 'var(--surface)', dot: '#E8901A', border: 'var(--border)' },
  fyi:    { label: 'FYI',    color: 'var(--text-secondary)', bg: 'var(--surface)', dot: '#aaa', border: 'var(--border)' },
}

const TYPE_ICONS = { handover: '🔄', member_note: '👤', general: '💬', photo: '📷' }

// Messages tab wording in all five languages. What people typed is
// translated live by <TranslatedText>.
const TEXT = {
  en: { type_handover: 'Handover', type_member_note: 'Member', type_general: 'General', type_photo: 'Photo',
        just_now: 'Just now', mins_ago: '{n}m ago', hrs_ago: '{n}h ago', new: 'NEW',
        no_description: 'No description added.', resolving: 'Resolving…', resolve: 'Mark as resolved',
        urgent: 'Urgent', n_unread: '{n} unread', all: 'All', day_to_day: 'Day-to-day', no_messages: 'No messages.', fyi: 'FYI' },
  fr: { type_handover: 'Passation', type_member_note: 'Membre', type_general: 'Général', type_photo: 'Photo',
        just_now: "À l'instant", mins_ago: 'il y a {n} min', hrs_ago: 'il y a {n} h', new: 'NOUVEAU',
        no_description: 'Aucune description.', resolving: 'Résolution…', resolve: 'Marquer comme résolu',
        urgent: 'Urgent', n_unread: '{n} non lu(s)', all: 'Tous', day_to_day: 'Au quotidien', no_messages: 'Aucun message.', fyi: 'Pour info' },
  es: { type_handover: 'Relevo', type_member_note: 'Socio', type_general: 'General', type_photo: 'Foto',
        just_now: 'Ahora mismo', mins_ago: 'hace {n} min', hrs_ago: 'hace {n} h', new: 'NUEVO',
        no_description: 'Sin descripción.', resolving: 'Resolviendo…', resolve: 'Marcar como resuelto',
        urgent: 'Urgente', n_unread: '{n} sin leer', all: 'Todos', day_to_day: 'Día a día', no_messages: 'No hay mensajes.', fyi: 'Para información' },
  it: { type_handover: 'Passaggio di consegne', type_member_note: 'Cliente', type_general: 'Generale', type_photo: 'Foto',
        just_now: 'Proprio ora', mins_ago: '{n} min fa', hrs_ago: '{n} h fa', new: 'NUOVO',
        no_description: 'Nessuna descrizione.', resolving: 'Risoluzione…', resolve: 'Segna come risolto',
        urgent: 'Urgente', n_unread: '{n} non letti', all: 'Tutti', day_to_day: 'Quotidiano', no_messages: 'Nessun messaggio.', fyi: 'Per info' },
  pt: { type_handover: 'Passagem de turno', type_member_note: 'Sócio', type_general: 'Geral', type_photo: 'Fotografia',
        just_now: 'Agora mesmo', mins_ago: 'há {n} min', hrs_ago: 'há {n} h', new: 'NOVO',
        no_description: 'Sem descrição.', resolving: 'A resolver…', resolve: 'Marcar como resolvido',
        urgent: 'Urgente', n_unread: '{n} por ler', all: 'Todos', day_to_day: 'Dia a dia', no_messages: 'Sem mensagens.', fyi: 'Para informação' },
}

function MessageCard({ message, staffId, onMarkRead, onResolve }) {
  const t = useT(TEXT)
  const { locale } = useLanguage()
  const timeAgo = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
    if (diff < 60)    return t('just_now')
    if (diff < 3600)  return t('mins_ago', { n: Math.floor(diff / 60) })
    if (diff < 86400) return t('hrs_ago', { n: Math.floor(diff / 3600) })
    return new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }
  const [expanded, setExpanded] = useState(false)
  const [images, setImages]     = useState([])
  const [resolving, setResolving] = useState(false)
  const isUnread   = !message.read_by?.includes(staffId)
  const isResolved = message.resolved === true
  const cfg = PRIORITY_CONFIG[message.priority] || PRIORITY_CONFIG.normal

  useEffect(() => {
    if (expanded) loadImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  const loadImages = async () => {
    const { data } = await supabase
      .from('message_images').select('image_url').eq('message_id', message.id)
    setImages(data?.map(i => i.image_url) || [])
  }

  const handleToggle = () => {
    setExpanded(e => !e)
    if (isUnread) onMarkRead(message.id)
  }

  const handleResolve = async (e) => {
    e.stopPropagation()
    setResolving(true)
    await onResolve(message.id)
    setResolving(false)
  }

  if (isResolved) return null

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--radius-md)', marginBottom: 10, overflow: 'hidden',
    }}>
      <div onClick={handleToggle} style={{
        padding: '12px 14px', cursor: 'pointer',
        display: 'flex', gap: 10, alignItems: 'flex-start'
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: cfg.dot,
          flexShrink: 0, marginTop: 6
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: cfg.color }}>
              <TranslatedText text={message.title} authorLang={message.staff?.language} compact />
            </span>
            {isUnread && message.priority === 'urgent' && (
              <span style={{
                fontSize: 10, fontWeight: 700, background: '#E8301A', color: '#fff',
                padding: '2px 6px', borderRadius: 4
              }}>{t('new')}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {TYPE_ICONS[message.type] ? `${TYPE_ICONS[message.type]} ${t(`type_${message.type}`)}` : message.type}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-light)' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {message.staff?.first_name} {message.staff?.last_name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-light)' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{timeAgo(message.created_at)}</span>
          </div>
        </div>
        <span style={{
          color: 'var(--text-light)', fontSize: 18, flexShrink: 0,
          transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s'
        }}>›</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          {message.body ? (
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, paddingTop: 12, whiteSpace: 'pre-wrap' }}>
              <TranslatedText text={message.body} authorLang={message.staff?.language} />
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-light)', paddingTop: 10, fontStyle: 'italic' }}>
              {t('no_description')}
            </div>
          )}
          {images.length > 0 && (
            <div className="image-preview-grid" style={{ marginTop: 10 }}>
              {images.map((url, i) => (
                <img key={i} src={url} className="image-preview" alt=""
                  onClick={() => window.open(url, '_blank')} style={{ cursor: 'pointer' }} />
              ))}
            </div>
          )}
          <button
            onClick={handleResolve}
            disabled={resolving}
            style={{
              marginTop: 14, width: '100%', padding: '10px',
              background: 'var(--success-bg)', color: 'var(--success)',
              border: '1px solid rgba(61,170,110,0.3)', borderRadius: 'var(--radius-md)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {resolving ? t('resolving') : `✓ ${t('resolve')}`}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Messages({ onNavigate }) {
  const { staff } = useAuth()
  const t = useT(TEXT)
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showFyi, setShowFyi]   = useState(false)
  const [filter, setFilter]     = useState('all')

  // For HQ / Region Mgr this is the site they're currently viewing.
  // For regular staff this is their own site.
  const scopedSiteId = staff.active_site_id || staff.site_id

  useEffect(() => { loadMessages() }, [scopedSiteId])

  // === REALTIME SYNC ===
  // When any admin resolves or reads a message at this site,
  // everyone else's view updates within ~1s.
  useEffect(() => {
    if (!scopedSiteId) return

    const channel = supabase
      .channel(`messages-sync-${scopedSiteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `site_id=eq.${scopedSiteId}` },
        () => loadMessages()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedSiteId])

  const loadMessages = async () => {
    if (!scopedSiteId) { setMessages([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*, staff:staff_id(first_name, last_name, language)')
      .eq('site_id', scopedSiteId)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(100)
    setMessages(data || [])
    setLoading(false)
  }

  const handleMarkRead = async (messageId) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, read_by: [...(m.read_by || []), staff.id] } : m
    ))
    const { data: current } = await supabase
      .from('messages').select('read_by').eq('id', messageId).single()
    const updated = [...new Set([...(current?.read_by || []), staff.id])]
    await supabase.from('messages').update({ read_by: updated }).eq('id', messageId)
  }

  const handleResolve = async (messageId) => {
    await supabase.from('messages').update({
      resolved: true,
      resolved_by: staff.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', messageId)
    // Realtime will reconcile, but remove locally for instant feedback
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }

  const urgent = messages.filter(m => m.priority === 'urgent')
  const normal = messages.filter(m => m.priority === 'normal')
  const fyi    = messages.filter(m => m.priority === 'fyi')

  const unreadUrgent   = urgent.filter(m => !m.read_by?.includes(staff.id)).length
  const filteredNormal = filter === 'all' ? normal : normal.filter(m => m.type === filter)

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-content">

      <NotesPanel siteId={scopedSiteId} mode="manager" />

      {urgent.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div className="section-heading" style={{ margin: 0, color: '#E8301A' }}>🔴 {t('urgent')}</div>
            {unreadUrgent > 0 && (
              <span style={{
                background: '#E8301A', color: '#fff', fontSize: 11,
                fontWeight: 700, padding: '2px 7px', borderRadius: 10
              }}>{t('n_unread', { n: unreadUrgent })}</span>
            )}
          </div>
          {urgent.map(m => (
            <MessageCard key={m.id} message={m} staffId={staff.id}
              onMarkRead={handleMarkRead} onResolve={handleResolve} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {['all', 'member_note', 'general', 'photo'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap',
            background: filter === f ? 'var(--aqua)' : 'var(--surface)',
            color: filter === f ? '#fff' : 'var(--text-secondary)',
          }}>
            {f === 'all' ? t('all') : t(`type_${f}`)}
          </button>
        ))}
      </div>

      <div className="section-heading">{t('day_to_day')}</div>
      {filteredNormal.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <div className="empty-state-text">{t('no_messages')}</div>
        </div>
      ) : (
        filteredNormal.map(m => (
          <MessageCard key={m.id} message={m} staffId={staff.id}
            onMarkRead={handleMarkRead} onResolve={handleResolve} />
        ))
      )}

      {fyi.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setShowFyi(f => !f)} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none',
            border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 10
          }}>
            <span style={{
              transform: showFyi ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s', display: 'inline-block'
            }}>›</span>
            {t('fyi')} ({fyi.length})
          </button>
          {showFyi && fyi.map(m => (
            <MessageCard key={m.id} message={m} staffId={staff.id}
              onMarkRead={handleMarkRead} onResolve={handleResolve} />
          ))}
        </div>
      )}
    </div>
  )
}
