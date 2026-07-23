// src/pages/registers/RegistersHub.jsx
// Landing for the Forms & Registers area. A single dropdown chooses the
// form/register (with a live open-item count in each option), then the
// shared Register view is shown below. Keeps navigation tidy — no extra
// tabs as more forms are added later.
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { REGISTERS, REGISTER_ORDER } from '../../lib/registers'
import Register from './Register'

export default function RegistersHub({ onExit }) {
  const { staff, isHQ } = useAuth()
  const [active, setActive] = useState(REGISTER_ORDER[0])
  const [counts, setCounts] = useState({})

  const scopedSiteId = staff.active_site_id || staff.site_id

  // Live "needs attention" count = records still in the first (open) status.
  const loadCounts = async () => {
    const next = {}
    for (const key of REGISTER_ORDER) {
      const cfg = REGISTERS[key]
      let q = supabase.from(cfg.table).select('id', { count: 'exact', head: true })
        .eq('status', cfg.statuses[0].value)
      if (!isHQ()) q = q.eq('site_id', scopedSiteId)
      const { count, error } = await q
      if (!error) next[key] = count || 0
    }
    setCounts(next)
  }

  useEffect(() => { loadCounts() }, [active])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Dropdown selector bar */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '14px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Forms &amp; Registers
          </div>
          {onExit && <button className="btn btn-outline btn-sm" onClick={onExit}>Done</button>}
        </div>
        <select
          className="form-input"
          value={active}
          onChange={e => setActive(e.target.value)}
          style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}
        >
          {Object.entries(
            REGISTER_ORDER.reduce((acc, key) => {
              const g = REGISTERS[key].group || 'Other'
              ;(acc[g] = acc[g] || []).push(key)
              return acc
            }, {})
          ).map(([group, keys]) => (
            <optgroup key={group} label={group}>
              {keys.map(key => {
                const cfg = REGISTERS[key]
                const c = counts[key]
                return (
                  <option key={key} value={key}>
                    {cfg.icon} {cfg.label}{c ? `  (${c})` : ''}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Selected register — remounts on change to reset its filter/state */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Register key={active} config={REGISTERS[active]} embedded onChanged={loadCounts} />
      </div>
    </div>
  )
}
