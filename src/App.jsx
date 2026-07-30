import React, { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import ShiftSelector from './pages/foh/ShiftSelector'
import ShiftTasks from './pages/foh/ShiftTasks'
import ComposeMessage from './pages/manager/shared/ComposeMessage'
import Dashboard from './pages/manager/Dashboard'
import StaffManagement from './pages/manager/StaffManagement'
import TaskLibrary from './pages/manager/TaskLibrary'
import ShiftBuilder from './pages/manager/ShiftBuilder'
import Issues from './pages/manager/Issues'
import Messages from './pages/manager/Messages'
import HQOverview from './pages/hq/Overview'
import Sites from './pages/hq/Sites'
import RegistersHub from './pages/registers/RegistersHub'

const Icon = ({ name, size = 22 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    staff:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    tasks:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    shifts:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    issues:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    messages:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    logs:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
    network:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    sites:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    logout:    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    compose:   <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="10" y1="10" x2="14" y2="10"/></svg>,
  }
  return icons[name] || null
}

function Header({ staff, onLogout, onCompose, onLogs, isFOH }) {
  const roleLabel = {
    trainee:        'Trainee',
    cleaner:        'Cleaner',
    foh:            'FOH',
    senior_foh:     'Sr. FOH',
    admin:          'Site Manager',
    region_manager: 'Region Mgr',
    hq:             'HQ',
  }
  const roleClass = {
    trainee:        'role-foh',
    cleaner:        'role-foh',
    foh:            'role-foh',
    senior_foh:     'role-foh',
    admin:          'role-admin',
    region_manager: 'role-admin',
    hq:             'role-hq',
  }
  // For HQ / Region Mgr, the active_site is the site they're currently viewing.
  // For regular staff, staff.sites is their home site. Either is fine to display.
  const siteName = staff.active_site?.name || staff.sites?.name || 'OPERATIONS'
  return (
    <div className="header">
      <div className="header-logo">
        <div className="header-brand">PODOR</div>
        <div className="header-site">{siteName}</div>
      </div>
      <div className="header-user">
        <div>
          <div className="header-name">{staff.first_name}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
            <span className={`header-role ${roleClass[staff.role] || 'role-foh'}`}>{roleLabel[staff.role] || staff.role}</span>
          </div>
        </div>
        {isFOH && (
          <button className="btn-icon" onClick={onLogs} aria-label="Logs">
            <Icon name="logs" size={20} />
          </button>
        )}
        {isFOH && (
          <button className="btn-icon" onClick={onCompose} aria-label="New message"
            style={{ color: '#D8F789' }}>
            <Icon name="compose" size={20} />
          </button>
        )}
        <button className="btn-icon" onClick={onLogout} aria-label="Log out">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </div>
  )
}

function ManagerNav({ tab, setTab, isHQ, unreadUrgent, hasUnread }) {
  const tabs = [
    { id: 'dashboard', label: 'Home',     icon: 'dashboard' },
    { id: 'messages',  label: 'Messages', icon: 'messages'  },
    { id: 'staff',     label: 'Staff',    icon: 'staff'     },
    { id: 'tasks',     label: 'Tasks',    icon: 'tasks'     },
    { id: 'shifts',    label: 'Shifts',   icon: 'shifts'    },
    { id: 'issues',    label: 'Issues',   icon: 'issues'    },
    { id: 'logs',      label: 'Forms',    icon: 'logs'      },
    ...(isHQ ? [
      { id: 'network', label: 'Network',  icon: 'network'   },
      { id: 'sites',   label: 'Sites',    icon: 'sites'     },
    ] : []),
  ]
  return (
    <div className="bottom-nav">
      {tabs.map(t => (
        <button key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`}
          onClick={() => setTab(t.id)} style={{ position: 'relative' }}>
          <Icon name={t.icon} size={20} />
          {t.id === 'messages' && unreadUrgent > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: '50%', transform: 'translateX(10px)',
              background: '#E8301A', color: '#fff', borderRadius: '50%',
              width: 16, height: 16, fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unreadUrgent}</span>
          )}
          {t.id === 'messages' && unreadUrgent === 0 && hasUnread && (
            <span style={{
              position: 'absolute', top: 5, right: '50%', transform: 'translateX(9px)',
              background: '#E8301A', borderRadius: '50%', width: 9, height: 9,
            }} />
          )}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const { staff, loading, logout, isAdmin, isHQ } = useAuth()
  const [selectedShift, setSelectedShift] = useState(null)
  const [locationData, setLocationData]   = useState(null)
  // HQ + Region Mgr land on 'network' overview by default;
  // Site admins land on their site dashboard.
  const defaultTab = (staff?.role === 'hq' || staff?.role === 'region_manager') ? 'network' : 'dashboard'
  const [managerTab, setManagerTab]       = useState(defaultTab)
  // When a Network/Home chip deep-links into the Forms area, this holds
  // which register to open (e.g. 'lost_found'). Null = the default first one.
  const [logsKey, setLogsKey]             = useState(null)
  const [composing, setComposing]         = useState(false)
  const [showLogs, setShowLogs]           = useState(false)
  const [unreadUrgent, setUnreadUrgent]   = useState(0)
  const [hasUnread, setHasUnread]         = useState(false)

  // Red dot on the Messages nav whenever there are unread messages.
  useEffect(() => {
    if (!staff || !isAdmin()) { setHasUnread(false); return }
    const scoped = staff.active_site_id || staff.site_id
    let alive = true
    const check = async () => {
      let q = supabase.from('messages').select('read_by').eq('resolved', false)
      if (scoped) q = q.eq('site_id', scoped)
      const { data } = await q
      if (alive) setHasUnread((data || []).some(m => !m.read_by?.includes(staff.id)))
    }
    check()
    const ch = supabase.channel('nav-unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => check())
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, managerTab])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">GYMPODS</div>
        <div style={{ fontSize: 11, color: 'rgba(127,192,195,0.4)', letterSpacing: 2, fontWeight: 600 }}>POD Operational Resource</div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', letterSpacing: 5, fontWeight: 800, marginTop: 2 }}>PODOR</div>
        <div className="spinner" style={{ marginTop: 32 }} />
      </div>
    )
  }

  if (!staff) return <Login />

  const handleLogout = () => {
    setSelectedShift(null)
    setLocationData(null)
    setManagerTab(defaultTab)
    setLogsKey(null)
    logout()
  }

  const handleShiftSelect = (shift, location) => {
    setSelectedShift(shift)
    setLocationData(location)
  }

  // ── Manager / Region Mgr / HQ view ─────────────────────────────────────
  if (isAdmin()) {
    const homeTab   = (staff.role === 'hq' || staff.role === 'region_manager') ? 'network' : 'dashboard'
    const homeLabel = homeTab === 'network' ? 'Network' : 'Home'

    // Single navigation entry point. Pages call onNavigate('logs', 'lost_found')
    // to jump straight to one register; onNavigate('issues') etc. as before.
    const navigate = (tab, payload) => {
      if (tab === 'logs') setLogsKey(typeof payload === 'string' ? payload : null)
      setManagerTab(tab)
    }

    const renderTab = () => {
      switch (managerTab) {
        case 'dashboard': return <Dashboard onNavigate={navigate} onUnreadUrgent={setUnreadUrgent} />
        case 'messages':  return <Messages onNavigate={navigate} />
        case 'staff':     return <StaffManagement />
        case 'tasks':     return <TaskLibrary />
        case 'shifts':    return <ShiftBuilder />
        case 'issues':    return <Issues onNavigate={navigate} />
        case 'logs':      return <RegistersHub key={logsKey || 'default'} initialKey={logsKey} />
        case 'network':   return <HQOverview onNavigate={navigate} />
        case 'sites':     return <Sites />
        default:          return <Dashboard onNavigate={navigate} onUnreadUrgent={setUnreadUrgent} />
      }
    }
    return (
      <div className="app-shell">
        <Header staff={staff} onLogout={handleLogout} isFOH={false} />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {managerTab !== homeTab && (
            <button onClick={() => navigate(homeTab)} style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'var(--white)', border: 'none',
              borderBottom: '1px solid var(--border)', padding: '10px 16px', fontSize: 13, fontWeight: 700,
              color: 'var(--navy)', cursor: 'pointer', flexShrink: 0, textAlign: 'left',
            }}>‹ {homeLabel}</button>
          )}
          {renderTab()}
        </div>
        <ManagerNav tab={managerTab} setTab={navigate} isHQ={isHQ()} unreadUrgent={unreadUrgent} hasUnread={hasUnread} />
      </div>
    )
  }

  // ── FOH view ───────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <Header staff={staff} onLogout={handleLogout} onCompose={() => setComposing(true)} onLogs={() => setShowLogs(true)} isFOH={true} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {selectedShift ? (
          <ShiftTasks
            shift={selectedShift}
            locationData={locationData}
            onBack={() => { setSelectedShift(null); setLocationData(null) }}
          />
        ) : (
          <ShiftSelector onSelectShift={handleShiftSelect} />
        )}
      </div>
      {composing && (
        <ComposeMessage onClose={() => setComposing(false)} />
      )}
      {showLogs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(13,33,55,0.4)', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, height: '100%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <RegistersHub onExit={() => setShowLogs(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
