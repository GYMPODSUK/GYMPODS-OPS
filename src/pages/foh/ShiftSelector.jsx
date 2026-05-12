import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

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
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
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

    // Filter by role AND day of week
    const relevantShifts = (allShifts || []).filter(s => {
      // Role filter
      if (s.visible_to_roles && s.visible_to_roles.length > 0) {
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

  const formatTime = (t) => {
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    const ampm = hour < 12 ? 'am' : 'pm'
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
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          {isWeekend && <span style={{ marginLeft: 8, color: 'var(--aqua)', fontWeight: 700 }}>Weekend</span>}
        </div>
      </div>

      {/* Location banners */}
      {locationStatus === 'on-site' && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(61,170,110,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📍</span>
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
            On site · {distance}m from {siteData?.name}
          </span>
        </div>
      )}
      {locationStatus === 'off-site' && (
        <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(232,144,26,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 700 }}>Not on site · {distance}m away</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4, marginLeft: 24 }}>
            You can still complete tasks but your location will be logged.
          </div>
        </div>
      )}

      <div className="section-heading">Select your shift</div>

      {shifts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">No shifts scheduled for today.<br/>Contact your manager.</div>
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
                        {done} of {total} tasks completed
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>No tasks assigned</div>
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
