// src/pages/manager/Messages.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#E8301A', bg: 'rgba(232,48,26,0.06)', dot: '#E8301A', border: 'rgba(232,48,26,0.2)' },
  normal: { label: 'Normal', color: 'var(--text-primary)', bg: 'var(--surface)', dot: '#E8901A', border: 'var(--border)' },
  fyi:    { label: 'FYI',    color: 'var(--text-secondary)', bg: 'var(--surface)', dot: '#aaa', border: 'var(--border)' },
}

const TYPE_LABELS = {
  handover:    '🔄 Handover',
  member_note: '👤 Member',
  general:     '💬 General',
  photo:       '📷 Photo',
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function MessageCard({ message, staffId, onMarkRead, onResolve }) {
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
            <span style={{ fontWeight: 700, fontSize: 14, color: cfg.color }}>{message.title}</span>
            {isUnread && message.priority === 'urgent' && (
              <span style={{
                fontSize: 10, fontWeight: 700, background: '#E8301A', color: '#fff',
                padding: '2px 6px', borderRadius: 4
              }}>NEW</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {TYPE_LABELS[message.type] || message.type}
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
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, paddingTop: 12 }}>
              {message.body}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-light)', paddingTop: 10, fontStyle: 'italic' }}>
              No description added.
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
            {resolving ? 'Resolving…' : '✓ Mark as resolved'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Messages() {
  const { staff } = useAuth()
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
      .select('*, staff:staff_id(first_name, last_name)')
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

      {urgent.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div className="section-heading" style={{ margin: 0, color: '#E8301A' }}>🔴 Urgent</div>
            {unreadUrgent > 0 && (
              <span style={{
                background: '#E8301A', color: '#fff', fontSize: 11,
                fontWeight: 700, padding: '2px 7px', borderRadius: 10
              }}>{unreadUrgent} unread</span>
            )}
          </div>
          {urgent.map(m => (
            <MessageCard key={m.id} message={m} staffId={staff.id}
              onMarkRead={handleMarkRead} onResolve={handleResolve} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {['all', 'handover', 'member_note', 'general', 'photo'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap',
            background: filter === f ? 'var(--aqua)' : 'var(--surface)',
            color: filter === f ? '#fff' : 'var(--text-secondary)',
          }}>
            {f === 'all' ? 'All' : f === 'member_note' ? 'Member' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="section-heading">Day-to-day</div>
      {filteredNormal.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <div className="empty-state-text">No messages.</div>
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
            FYI ({fyi.length})
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
