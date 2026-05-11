// src/pages/shared/ComposeMessage.jsx
import React, { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const TYPE_OPTIONS = [
  { value: 'handover',    label: '🔄 Handover note' },
  { value: 'member_note', label: '👤 Member note' },
  { value: 'general',     label: '💬 General' },
  { value: 'photo',       label: '📷 Photo' },
]

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '🔴 Urgent', hint: 'Manager will be notified immediately' },
  { value: 'normal', label: '🟡 Normal', hint: 'Appears in day-to-day feed' },
  { value: 'fyi',    label: '⚪ FYI',    hint: 'Low priority — logged for reference' },
]

export default function ComposeMessage({ onClose, onSent }) {
  const { staff } = useAuth()
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [type, setType]         = useState('general')
  const [priority, setPriority] = useState('normal')
  const [images, setImages]     = useState([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const fileRef = useRef()

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files)
    setImages(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f) }))])
  }

  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const uploadImage = async (file, messageId) => {
    const ext = file.name.split('.').pop()
    const path = `${messageId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('message-images').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('message-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSend = async () => {
    if (!title.trim()) { setError('Please add a title'); return }
    setSaving(true)
    setError(null)
    try {
      const { data: message, error: msgErr } = await supabase
        .from('messages')
        .insert({
          site_id:  staff.site_id,
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
      setError('Something went wrong — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <div className="modal-title">+ New Message</div>

        <div className="form-group">
          <label className="form-label">Title <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="form-input" placeholder="Brief summary…"
            value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{
          fontSize: 11, color: 'var(--text-secondary)', marginTop: -4, marginBottom: 14,
          padding: '6px 10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)'
        }}>
          {PRIORITY_OPTIONS.find(o => o.value === priority)?.hint}
        </div>

        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <textarea className="form-input" rows={3} placeholder="Add more detail…"
            value={body} onChange={e => setBody(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Photos (optional)</label>
          <input type="file" accept="image/*" multiple capture="environment"
            ref={fileRef} style={{ display: 'none' }} onChange={handleImageAdd} />
          <div className="image-upload-area" onClick={() => fileRef.current?.click()}>
            📷 Tap to take photo or choose from library
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

        {error && (
          <div style={{
            color: 'var(--danger)', fontSize: 13, marginBottom: 10,
            padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)'
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend}
            disabled={saving || !title.trim()} style={{ flex: 2 }}>
            {saving ? 'Sending…' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  )
}
