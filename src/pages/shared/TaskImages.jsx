import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export const MAX_TASK_IMAGES = 6

/**
 * Fetch reference images for a set of tasks in one query.
 * Returns { [task_id]: [ {id, image_url, sort_order}, ... ] }
 */
export async function fetchTaskImages(taskIds) {
  const ids = (taskIds || []).filter(Boolean)
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('task_images')
    .select('id, task_id, image_url, sort_order')
    .in('task_id', ids)
    .order('sort_order')
  if (error) return {}
  const map = {}
  for (const row of data || []) {
    if (!map[row.task_id]) map[row.task_id] = []
    map[row.task_id].push(row)
  }
  return map
}

/**
 * Thumbnail strip with a tap-to-enlarge viewer. Used on the Task Library
 * cards and on the FOH shift screen, so staff and managers see the same
 * reference photos in the same way.
 */
export default function TaskImageStrip({ images, size = 56, showLabel = false }) {
  const [openAt, setOpenAt] = useState(null)

  if (!images || images.length === 0) return null

  const count = images.length
  const go = (delta) => setOpenAt(prev => (prev + delta + count) % count)

  return (
    <>
      {showLabel && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-light)',
          textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
        }}>
          How it should look
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {images.map((img, i) => (
          <button
            key={img.id || i}
            onClick={(e) => { e.stopPropagation(); setOpenAt(i) }}
            title="Tap to enlarge"
            style={{
              width: size, height: size, padding: 0, flexShrink: 0, cursor: 'pointer',
              borderRadius: 'var(--radius-sm)', overflow: 'hidden',
              border: '1px solid var(--border)', background: 'var(--off-white)',
            }}
          >
            <img src={img.image_url} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>

      {/* Full-screen viewer */}
      {openAt !== null && (
        <div
          onClick={(e) => { e.stopPropagation(); setOpenAt(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(8,20,30,0.94)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 16, gap: 14,
          }}
        >
          <img src={images[openAt].image_url} alt=""
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%', maxHeight: '76vh', objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
            }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {count > 1 && (
              <button onClick={(e) => { e.stopPropagation(); go(-1) }} style={viewerBtn}>‹</button>
            )}
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, minWidth: 48, textAlign: 'center' }}>
              {count > 1 ? `${openAt + 1} / ${count}` : ''}
            </span>
            {count > 1 && (
              <button onClick={(e) => { e.stopPropagation(); go(1) }} style={viewerBtn}>›</button>
            )}
          </div>

          <button onClick={(e) => { e.stopPropagation(); setOpenAt(null) }} style={{
            background: 'rgba(255,255,255,0.12)', color: 'var(--white)', border: 'none',
            borderRadius: 'var(--radius-md)', padding: '10px 22px', fontSize: 14,
            fontWeight: 700, cursor: 'pointer',
          }}>Close</button>
        </div>
      )}
    </>
  )
}

const viewerBtn = {
  background: 'rgba(255,255,255,0.12)', color: 'var(--white)', border: 'none',
  borderRadius: '50%', width: 40, height: 40, fontSize: 24, fontWeight: 700,
  cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center',
  justifyContent: 'center', flexShrink: 0,
}
