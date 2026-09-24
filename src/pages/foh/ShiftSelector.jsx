import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import NotesPanel from '../notes/NotesPanel'
import { useT, useLanguage } from '../../lib/i18n'

// Shift selector wording in all five languages.
// Shift NAMES (e.g. "Early Morning") are set by managers, so they stay as
// typed for now — they'll be covered in the later task-content batch.
const TEXT = {
  en: {
    good_morning: 'Good morning', good_afternoon: 'Good afternoon', good_evening: 'Good evening',
    weekend: 'Weekend',
    on_site: 'On site · {m}m from {site}',
    off_site: 'Not on site · {m}m away',
    off_site_note: 'You can still complete tasks but your location will be logged.',
    select_shift: 'Select your shift',
    no_shifts: 'No shifts scheduled for today.', contact_manager: 'Contact your manager.',
    tasks_done: '{done} of {total} tasks completed',
    no_tasks: 'No tasks assigned',
  },
  fr: {
    good_morning: 'Bonjour', good_afternoon: 'Bon après-midi', good_evening: 'Bonsoir',
    weekend: 'Week-end',
    on_site: 'Sur place · à {m} m de {site}',
    off_site: 'Pas sur place · à {m} m',
    off_site_note: 'Vous pouvez quand même effectuer les tâches, mais votre position sera enregistrée.',
    select_shift: 'Choisissez votre service',
    no_shifts: "Aucun service prévu aujourd'hui.", contact_manager: 'Contactez votre responsable.',
    tasks_done: '{done} sur {total} tâches effectuées',
    no_tasks: 'Aucune tâche attribuée',
  },
  es: {
    good_morning: 'Buenos días', good_afternoon: 'Buenas tardes', good_evening: 'Buenas tardes',
    weekend: 'Fin de semana',
    on_site: 'En el centro · a {m} m de {site}',
    off_site: 'Fuera del centro · a {m} m',
    off_site_note: 'Puedes completar las tareas, pero se registrará tu ubicación.',
    select_shift: 'Elige tu turno',
    no_shifts: 'No hay turnos programados para hoy.', contact_manager: 'Contacta con tu gerente.',
    tasks_done: '{done} de {total} tareas completadas',
    no_tasks: 'Sin tareas asignadas',
  },
  it: {
    good_morning: 'Buongiorno', good_afternoon: 'Buon pomeriggio', good_evening: 'Buonasera',
    weekend: 'Weekend',
    on_site: 'In sede · a {m} m da {site}',
    off_site: 'Non in sede · a {m} m',
    off_site_note: 'Puoi comunque completare i compiti, ma la tua posizione verrà registrata.',
    select_shift: 'Seleziona il tuo turno',
    no_shifts: 'Nessun turno previsto per oggi.', contact_manager: 'Contatta il tuo responsabile.',
    tasks_done: '{done} di {total} compiti completati',
    no_tasks: 'Nessun compito assegnato',
  },
  pt: {
    good_morning: 'Bom dia', good_afternoon: 'Boa tarde', good_evening: 'Boa noite',
    weekend: 'Fim de semana',
    on_site: 'No local · a {m} m de {site}',
    off_site: 'Fora do local · a {m} m',
    off_site_note: 'Pode concluir as tarefas na mesma, mas a sua localização será registada.',
    select_shift: 'Selecione o seu turno',
    no_shifts: 'Não há turnos agendados para hoje.', contact_manager: 'Contacte o seu gestor.',
    tasks_done: '{done} de {total} tarefas concluídas',
    no_tasks: 'Nenhuma tarefa atribuída',
  },
}

const SHIFT_ICONS = {
  'Early Morning': '🌅', 'Mid Shift': '☀️', 'Evening': '🌆', 'Overnight': '🌙',
  'Weekend Morning': '🌤️', 'Weekend Afternoon': '🌞', 'Weekend Overnight': '🌙',
  'Morning Clean': '🧹', 'Evening Clean': '🧹',
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getDistanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default function ShiftSelector({ onSelectShift }) {
  const { staff } = useAuth()
  const t = useT(TEXT)
  const { lang, locale } = useLanguage()
  const [shifts, setShifts]                 = useState([])
  const [completions, setCompletions]       = useState({})
  const [taskCounts, setTaskCounts]         = useState({})
  const [loading, setLoading]               = useState(true)
  const [siteData, setSiteData]             = useState(null)
  const [locationStatus, setLocationStatus] = useState('checking')
  const [userLocation, setUserLocation]     = useState(null)
  const [distance, setDistance]             = useState(null)

  const today      = new Date().toISOString().split('T')[0]
  const todayKey   = DAY_KEYS[new Date().getDay()] // 'mon', 'tue', etc.
  const isWeekend  = [0, 6].includes(new Date().getDay())

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('good_morning')
    if (h < 17) return t('good_afternoon')
    return t('good_evening')
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (siteData) checkLocation() }, [siteData])

  const loadData = async () => {
    setLoading(true)

    const { data: site } = await supabase
      .from('sites').select('*').eq('id', staff.site_id).single()
    setSiteData(site)

    const { data: allShifts } = await supabase
      .from('shift_definitions').select('*')
      .eq('site_id', staff.site_id).order('order_index')

    // A manager covering a shift needs to see every shift at the site,
    // not just the ones normally rostered to their own role.
    const isCoveringManager = ['admin', 'region_manager', 'hq'].includes(staff.role)

    // Filter by role AND day of week
    const relevantShifts = (allShifts || []).filter(s => {
      // Role filter
      if (!isCoveringManager && s.visible_to_roles && s.visible_to_roles.length > 0) {
        if (!s.visible_to_roles.includes(staff.role)) return false
      }
      // Day of week filter
      if (s.days_of_week && s.days_of_week.length > 0) {
        if (!s.days_of_week.includes(todayKey)) return false
      }
      return true
    })

    setShifts(relevantShifts)

    // Today's completions
    const { data: compData } = await supabase
      .from('task_completions').select('shift_id, task_id')
      .eq('site_id', staff.site_id).eq('date', today)
    const counts = {}
    if (compData) compData.forEach(c => { counts[c.shift_id] = (counts[c.shift_id] || 0) + 1 })
    setCompletions(counts)

    // Task counts per shift
    if (relevantShifts.length) {
      const { data: tcData } = await supabase
        .from('shift_tasks').select('shift_id')
        .in('shift_id', relevantShifts.map(s => s.id))
      const tc = {}
      if (tcData) tcData.forEach(t => { tc[t.shift_id] = (tc[t.shift_id] || 0) + 1 })
      setTaskCounts(tc)
    }

    setLoading(false)
  }

  const checkLocation = () => {
    if (!siteData?.latitude || !siteData?.longitude) { setLocationStatus('no-coords'); return }
    if (!navigator.geolocation) { setLocationStatus('no-coords'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserLocation({ latitude, longitude })
        const dist = getDistanceMetres(latitude, longitude, siteData.latitude, siteData.longitude)
        setDistance(Math.round(dist))
        setLocationStatus(dist <= (siteData.geofence_radius || 200) ? 'on-site' : 'off-site')
      },
      (err) => setLocationStatus(err.code === 1 ? 'denied' : 'no-coords'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }

  const formatTime = (time) => {
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour < 12 ? 'am' : 'pm'
    if (lang !== 'en') return `${String(hour).padStart(2, '0')}:${m}`   // 24-hour on the continent
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${display}:${m}${ampm}`
  }

  const handleShiftSelect = (shift) => {
    onSelectShift(shift, {
      onSite:    locationStatus === 'on-site' || locationStatus === 'no-coords',
      latitude:  userLocation?.latitude  || null,
      longitude: userLocation?.longitude || null,
    })
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-content">

      {/* Greeting */}
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--aqua)' }}>
          {greeting()}, {staff.first_name}.
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: 500 }}>
          {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          {isWeekend && <span style={{ marginLeft: 8, color: 'var(--aqua)', fontWeight: 700 }}>{t('weekend')}</span>}
        </div>
      </div>

      {/* Team messages addressed to this person — first thing they see after
          logging in, before picking a shift. Hidden when there are none. */}
      <NotesPanel siteId={staff.active_site_id || staff.site_id} mode="me" />

      {/* Location banners */}
      {locationStatus === 'on-site' && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(61,170,110,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📍</span>
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
            {t('on_site', { m: distance, site: siteData?.name || '' })}
          </span>
        </div>
      )}
      {locationStatus === 'off-site' && (
        <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(232,144,26,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 700 }}>{t('off_site', { m: distance })}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4, marginLeft: 24 }}>
            {t('off_site_note')}
          </div>
        </div>
      )}

      <div className="section-heading">{t('select_shift')}</div>

      {shifts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">{t('no_shifts')}<br/>{t('contact_manager')}</div>
        </div>
      ) : (
        shifts.map(shift => {
          const done  = completions[shift.id] || 0
          const total = taskCounts[shift.id]  || 0
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0
          return (
            <button key={shift.id} className="shift-card" onClick={() => handleShiftSelect(shift)}
              style={{ width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                <div style={{
                  width: 48, height: 48, background: 'var(--aqua-light)', borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0
                }}>
                  {SHIFT_ICONS[shift.name] || '🕐'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{shift.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                  </div>
                  {total > 0 ? (
                    <>
                      <div className="progress-bar" style={{ marginTop: 8 }}>
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                        {t('tasks_done', { done, total })}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>{t('no_tasks')}</div>
                  )}
                </div>
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: 20 }}>›</div>
            </button>
          )
        })
      )}
    </div>
  )
}
