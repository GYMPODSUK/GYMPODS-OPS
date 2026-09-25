// src/pages/registers/RegistersHub.jsx
// Landing for the Forms & Registers area. A single dropdown chooses the
// form/register (with a live open-item count in each option), then the
// shared Register view is shown below. Keeps navigation tidy — no extra
// tabs as more forms are added later.
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { REGISTERS, REGISTER_ORDER, localiseRegister, localiseGroup } from '../../lib/registers'
import { useT, useLanguage } from '../../lib/i18n'
import Register from './Register'

const TEXT = {
  en: { title: 'Forms & Registers',        done: 'Done' },
  fr: { title: 'Formulaires et registres', done: 'Terminé' },
  es: { title: 'Formularios y registros',  done: 'Listo' },
  it: { title: 'Moduli e registri',        done: 'Fatto' },
  pt: { title: 'Formulários e registos',   done: 'Concluído' },
}

export default function RegistersHub({ onExit, initialKey }) {
  const { staff } = useAuth()
  const t = useT(TEXT)
  const { lang } = useLanguage()
  // initialKey lets a Network/Home chip deep-link straight to one register.
  const [active, setActive] = useState(
    initialKey && REGISTERS[initialKey] ? initialKey : REGISTER_ORDER[0]
  )
  const [counts, setCounts] = useState({})

  const scopedSiteId = staff.active_site_id || staff.site_id

  // Live "needs attention" count = records still in the first (open) status,
  // for the gym currently being viewed (matches the Network / Home chips).
  const loadCounts = async () => {
    const next = {}
    for (const key of REGISTER_ORDER) {
      const cfg = REGISTERS[key]
      let q = supabase.from(cfg.table).select('id', { count: 'exact', head: true })
        .eq('status', cfg.statuses[0].value)
      if (scopedSiteId) q = q.eq('site_id', scopedSiteId)
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
            {t('title')}
          </div>
          {onExit && <button className="btn btn-outline btn-sm" onClick={onExit}>{t('done')}</button>}
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
            <optgroup key={group} label={localiseGroup(group, lang)}>
              {keys.map(key => {
                const cfg = localiseRegister(REGISTERS[key], lang)
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
        {/* Wording follows the chosen language; the underlying form is the same. */}
        <Register key={active} config={localiseRegister(REGISTERS[active], lang)} embedded onChanged={loadCounts} />
      </div>
    </div>
  )
}
