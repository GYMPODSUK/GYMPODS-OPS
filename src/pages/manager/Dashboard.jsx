import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import NotesPanel from '../notes/NotesPanel'
import SiteTasksModal from '../hq/SiteTasksModal'
import { shiftsRunningOn } from '../../lib/schedule'

export default function Dashboard({ onNavigate, onUnreadUrgent }) {
  const { staff, isHQ } = useAuth()
  const [stats, setStats] = useState({
    completed: 0, flagged: 0, openIssues: 0, inProgress: 0, totalTasks: 0,
    complaints: 0, incidents: 0, lostFound: 0, visitors: 0,
  })
  const [recentIssues, setRecentIssues] = useState([])
  const [reports, setReports] = useState([])   // open complaints + incidents at this site
  const [shiftSummary, setShiftSummary] = useState([])
  const [urgentMessages, setUrgentMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTasks, setShowTasks] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  // The site this dashboard is scoped to (the gym you've opened, or your own).
  const scopedSiteId   = staff.active_site_id || staff.site_id
  const scopedSiteName = staff.active_site?.name || staff.sites?.name || 'this site'
  const isRegionMgr    = staff.role === 'region_manager'

  useEffect(() => { loadData() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scopedSiteId])

  // Keep Home live the same way the Network view is, so a manager sees new
  // items land without pulling to refresh.
  useEffect(() => {
    if (!scopedSiteId) return
    const channel = supabase.channel(`home-live-${scopedSiteId}`)
    for (const table of ['issues', 'task_completions', 'messages', 'complaints', 'incidents', 'lost_found', 'visitors', 'notes']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => loadData())
    }
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedSiteId])

  const loadData = async () => {
    setLoading(true)

    // Task completions today
    let compQuery = supabase
      .from('task_completions').select('status, shift_id, shift_definitions(name)')
      .eq('date', today)
    if (scopedSiteId) compQuery = compQuery.eq('site_id', scopedSiteId)
    const { data: compData } = await compQuery

    const completed = compData?.filter(c => c.status === 'completed').length || 0
    const flagged   = compData?.filter(c => c.status === 'flagged').length || 0

    // Open issues
    let issueQuery = supabase
      .from('issues')
      .select('*, reporter:staff_id(first_name), sites:site_id(name)')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(8)
    if (scopedSiteId) issueQuery = issueQuery.eq('site_id', scopedSiteId)
    const { data: issueData } = await issueQuery

    const openIssues = issueData?.filter(i => i.status === 'open').length || 0
    const inProgress = issueData?.filter(i => i.status === 'in_progress').length || 0

    // Open complaints + incidents at this site (shown on Home)
    let reportsList = []
    if (scopedSiteId) {
      const [{ data: cData }, { data: iData }] = await Promise.all([
        supabase.from('complaints').select('id, description, severity, created_at')
          .eq('site_id', scopedSiteId).eq('status', 'open').order('created_at', { ascending: false }).limit(10),
        supabase.from('incidents').select('id, description, severity, created_at')
          .eq('site_id', scopedSiteId).eq('status', 'open').order('created_at', { ascending: false }).limit(10),
      ])
      reportsList = [
        ...(cData || []).map(c => ({ ...c, kind: 'Complaint' })),
        ...(iData || []).map(i => ({ ...i, kind: 'Incident' })),
      ]
    }
    setReports(reportsList)

    // Attention counts + today's task total — the same signals the HQ
    // Network card shows, scoped to this one gym.
    let extra = { totalTasks: 0, complaints: 0, incidents: 0, lostFound: 0, visitors: 0 }
    if (scopedSiteId) {
      // Today's task total = tasks on the shifts that actually run today.
      const { data: shiftDefs } = await supabase
        .from('shift_definitions').select('id, days_of_week').eq('site_id', scopedSiteId)
      const todayShiftIds = shiftsRunningOn(shiftDefs).map(sd => sd.id)
      const { count: todayTaskCount } = todayShiftIds.length
        ? await supabase.from('shift_tasks').select('id', { count: 'exact', head: true })
            .in('shift_id', todayShiftIds)
        : { count: 0 }

      const [
        { count: complaintsCount }, { count: incidentsCount },
        { count: lostFoundCount }, { count: visitorsCount },
      ] = await Promise.all([
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('site_id', scopedSiteId).eq('status', 'open'),
        supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('site_id', scopedSiteId).eq('status', 'open'),
        supabase.from('lost_found').select('id', { count: 'exact', head: true }).eq('site_id', scopedSiteId).eq('status', 'unclaimed'),
        supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('site_id', scopedSiteId).eq('status', 'on_site'),
      ])
      extra = {
        totalTasks: todayTaskCount || 0,
        complaints: complaintsCount || 0,
        incidents:  incidentsCount  || 0,
        lostFound:  lostFoundCount  || 0,
        visitors:   visitorsCount   || 0,
      }
    }

    // Shift breakdown
    const shiftMap = {}
    if (compData) {
      compData.forEach(c => {
        const name = c.shift_definitions?.name || 'Unknown'
        if (!shiftMap[name]) shiftMap[name] = { completed: 0, flagged: 0 }
        if (c.status === 'completed') shiftMap[name].completed++
        if (c.status === 'flagged')   shiftMap[name].flagged++
      })
    }

    // Urgent unread messages
    let msgQuery = supabase
      .from('messages').select('id, title, created_at, read_by, staff:staff_id(first_name)')
      .eq('priority', 'urgent')
      .eq('resolved', false)
      .eq('site_id', scopedSiteId)
      .order('created_at', { ascending: false })
      .limit(5)
    const { data: msgData } = await msgQuery

    const unread = (msgData || []).filter(m => !m.read_by?.includes(staff.id))
    setUrgentMessages(unread)
    onUnreadUrgent?.(unread.length)

    setStats({ completed, flagged, openIssues, inProgress, ...extra })
    setRecentIssues(issueData || [])
    setShiftSummary(Object.entries(shiftMap))
    setLoading(false)
  }

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  // Same signals as the HQ Network card, scoped to this gym. Every chip is
  // tappable and lands on the screen the number came from.
  const doneToday = stats.completed + stats.flagged
  const pct = stats.totalTasks > 0 ? Math.round((doneToday / stats.totalTasks) * 100) : 0
  const chips = [
    { n: stats.openIssues, label: 'Issues',       color: 'var(--danger)',    bg: 'var(--danger-bg)',  go: () => onNavigate?.('issues') },
    { n: stats.inProgress, label: 'In progress',  color: 'var(--warning)',   bg: 'var(--warning-bg)', go: () => onNavigate?.('issues') },
    { n: stats.complaints, label: 'Complaints',   color: 'var(--danger)',    bg: 'var(--danger-bg)',  go: () => onNavigate?.('logs', 'complaints') },
    { n: stats.incidents,  label: 'Incidents',    color: 'var(--warning)',   bg: 'var(--warning-bg)', go: () => onNavigate?.('logs', 'incidents') },
    { n: stats.flagged,    label: 'Flagged',      color: 'var(--warning)',   bg: 'var(--warning-bg)', go: () => setShowTasks(true) },
    { n: stats.lostFound,  label: 'Lost & Found', color: 'var(--warning)',   bg: 'var(--warning-bg)', go: () => onNavigate?.('logs', 'lost_found') },
    { n: stats.visitors,   label: 'On site',      color: 'var(--aqua-dark)', bg: 'var(--aqua-light)', go: () => onNavigate?.('logs', 'visitors') },
  ].filter(c => (c.n || 0) > 0)

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-content">
      {/* Date heading */}
      <div>
        <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--navy)' }}>Today's Overview</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Manager-addressed notes */}
      <NotesPanel siteId={scopedSiteId} mode="all" />

      {/* Urgent messages banner */}
      {urgentMessages.length > 0 && (
        <button onClick={() => onNavigate?.('messages')} style={{
          width: '100%', textAlign: 'left', background: 'rgba(232,48,26,0.06)',
          border: '1.5px solid rgba(232,48,26,0.25)', borderRadius: 'var(--radius-md)',
          padding: '12px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔴</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#E8301A' }}>
                {urgentMessages.length} urgent message{urgentMessages.length > 1 ? 's' : ''} unread
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {urgentMessages[0]?.title}
                {urgentMessages.length > 1 && ` +${urgentMessages.length - 1} more`}
              </div>
            </div>
          </div>
          <span style={{ color: '#E8301A', fontSize: 18 }}>›</span>
        </button>
      )}

      {/* Attention + today's tasks — the HQ Network card for this one gym */}
      <div className="card">
        {chips.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {chips.map(c => (
              <button key={c.label} onClick={c.go} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: c.bg, color: c.color, fontWeight: 700, fontSize: 12,
                padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${c.color}33`,
              }}>
                <span style={{
                  background: c.color, color: '#fff', borderRadius: 10, minWidth: 16,
                  height: 16, padding: '0 4px', fontSize: 11, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>{c.n}</span>
                {c.label}
                <span style={{ opacity: 0.5, fontSize: 13, marginLeft: 1 }}>›</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14,
            color: 'var(--success)', fontWeight: 700, fontSize: 13,
          }}>✓ All clear</div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {doneToday} of {stats.totalTasks} tasks completed today ({pct}%)
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {scopedSiteId && (
          <button className="btn btn-outline btn-sm" onClick={() => setShowTasks(true)}
            style={{ width: '100%', marginTop: 14 }}>
            📋 View today's tasks (done &amp; outstanding)
          </button>
        )}
      </div>

      {reports.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Complaints &amp; incidents</div>
            <button onClick={() => onNavigate?.('logs')} style={{ fontSize: 12, color: 'var(--aqua)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Open forms ›</button>
          </div>
          {reports.map(r => (
            <button key={r.kind + r.id} onClick={() => onNavigate?.('logs')} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <div className="list-item">
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: r.severity === 'high' ? 'var(--danger)' : r.severity === 'medium' ? 'var(--warning)' : 'var(--text-light)',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.kind}{r.severity ? ` · ${r.severity}` : ''}</div>
                  {r.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                      {r.description.length > 60 ? r.description.slice(0, 60) + '…' : r.description}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 16, color: 'var(--text-light)' }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Shift breakdown */}
      {shiftSummary.length > 0 && (
        <div className="card">
          <div className="card-title">Shift activity today</div>
          {shiftSummary.map(([name, data]) => (
            <div key={name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {data.completed > 0 && <span className="badge badge-completed">{data.completed} done</span>}
                  {data.flagged > 0   && <span className="badge badge-flagged">{data.flagged} flagged</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Open issues */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Open issues</div>
          {recentIssues.length > 0 && (
            <button onClick={() => onNavigate?.('issues')} style={{
              fontSize: 12, color: 'var(--aqua)', fontWeight: 700,
              background: 'none', border: 'none', cursor: 'pointer'
            }}>View all ›</button>
          )}
        </div>
        {recentIssues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-light)', fontSize: 14 }}>
            ✓ No open issues
          </div>
        ) : (
          recentIssues.map(issue => (
            <button key={issue.id} onClick={() => onNavigate?.('issues')} style={{
              width: '100%', textAlign: 'left', background: 'none',
              border: 'none', padding: 0, cursor: 'pointer'
            }}>
              <div className="list-item">
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: issue.status === 'open' ? 'var(--danger)' : 'var(--warning)'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{issue.task_name || 'Issue'}</div>
                  {issue.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                      {issue.description.length > 60 ? issue.description.slice(0, 60) + '…' : issue.description}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>
                    {issue.reporter?.first_name}
                    {isHQ() && issue.sites && ` · ${issue.sites.name}`}
                    {' · '}{timeAgo(issue.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className={`badge badge-${issue.status}`}>
                    {issue.status === 'in_progress' ? 'In Prog.' : issue.status}
                  </span>
                  <span style={{ fontSize: 16, color: 'var(--text-light)' }}>›</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {showTasks && scopedSiteId && (
        <SiteTasksModal site={{ id: scopedSiteId, name: scopedSiteName }} onClose={() => setShowTasks(false)} />
      )}
    </div>
  )
}
