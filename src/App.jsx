import React, { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
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

const Icon = ({ name, size = 22 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    staff:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    tasks:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    shifts:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    issues:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    messages:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    network:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    sites:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    logout:    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    compose:   <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="10" y1="10" x2="14" y2="10"/></svg>,
  }
  return icons[name] || null
}

function Header({ staff, onLogout, onCompose, isFOH }) {
  const roleLabel = { trainee: 'Trainee', cleaner: 'Cleaner', foh: 'FOH', senior_foh: 'Sr. FOH', admin: 'Manager', hq: 'HQ' }
  const roleClass = { trainee: 'role-foh', cleaner: 'role-foh', foh: 'role-foh', senior_foh: 'role-foh', admin: 'role-admin', hq: 'role-hq' }
  return (
    <div className="header">
      <div className="header-logo">
        <div className="header-brand">GYMPODS</div>
        <div className="header-site">{staff.sites?.name || 'OPS'}</div>
      </div>
      <div className="header-user">
        <div>
          <div className="header-name">{staff.first_name}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
            <span className={`header-role ${roleClass[staff.role]}`}>{roleLabel[staff.role]}</span>
          </div>
        </div>
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

function ManagerNav({ tab, setTab, isHQ, unreadUrgent }) {
  const tabs = [
    { id: 'dashboard', label: 'Home',     icon: 'dashboard' },
    { id: 'messages',  label: 'Messages', icon: 'messages'  },
    { id: 'staff',     label: 'Staff',    icon: 'staff'     },
    { id: 'tasks',     label: 'Tasks',    icon: 'tasks'     },
    { id: 'shifts',    label: 'Shifts',   icon: 'shifts'    },
    { id: 'issues',    label: 'Issues',   icon: 'issues'    },
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
  const [managerTab, setManagerTab]       = useState('dashboard')
  const [composing, setComposing]         = useState(false)
  const [unreadUrgent, setUnreadUrgent]   = useState(0)

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">GYMPODS</div>
        <div style={{ fontSize: 11, color: 'rgba(127,192,195,0.4)', letterSpacing: 4, fontWeight: 600 }}>OPS</div>
        <div className="spinner" style={{ marginTop: 32 }} />
      </div>
    )
  }

  if (!staff) return <Login />

  const handleLogout = () => {
    setSelectedShift(null)
    setLocationData(null)
    setManagerTab('dashboard')
    logout()
  }

  const handleShiftSelect = (shift, location) => {
    setSelectedShift(shift)
    setLocationData(location)
  }

  // ── Manager / HQ view ──────────────────────────────────────────────────
  if (isAdmin()) {
    const renderTab = () => {
      switch (managerTab) {
        case 'dashboard': return <Dashboard onNavigate={setManagerTab} onUnreadUrgent={setUnreadUrgent} />
        case 'messages':  return <Messages />
        case 'staff':     return <StaffManagement />
        case 'tasks':     return <TaskLibrary />
        case 'shifts':    return <ShiftBuilder />
        case 'issues':    return <Issues />
        case 'network':   return <HQOverview />
        case 'sites':     return <Sites />
        default:          return <Dashboard onNavigate={setManagerTab} onUnreadUrgent={setUnreadUrgent} />
      }
    }
    return (
      <div className="app-shell">
        <Header staff={staff} onLogout={handleLogout} isFOH={false} />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {renderTab()}
        </div>
        <ManagerNav tab={managerTab} setTab={setManagerTab} isHQ={isHQ()} unreadUrgent={unreadUrgent} />
      </div>
    )
  }

  // ── FOH view ───────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <Header staff={staff} onLogout={handleLogout} onCompose={() => setComposing(true)} isFOH={true} />
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
    </div>
  )
}
