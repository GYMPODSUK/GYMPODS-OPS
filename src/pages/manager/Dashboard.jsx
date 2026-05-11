import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function Dashboard({ onNavigate, onUnreadUrgent }) {
  const { staff, isHQ } = useAuth()
  const [stats, setStats] = useState({ completed: 0, flagged: 0, openIssues: 0, inProgress: 0 })
  const [recentIssues, setRecentIssues] = useState([])
  const [shiftSummary, setShiftSummary] = useState([])
  const [urgentMessages, setUrgentMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)

    // Task completions today
    let compQuery = supabase
      .from('task_completions').select('status, shift_id, shift_definitions(name)')
      .eq('date', today)
    if (!isHQ()) compQuery = compQuery.eq('site_id', staff.site_id)
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
    if (!isHQ()) issueQuery = issueQuery.eq('site_id', staff.site_id)
    const { data: issueData } = await issueQuery

    const openIssues = issueData?.filter(i => i.status === 'open').length || 0
    const inProgress = issueData?.filter(i => i.status === 'in_progress').length || 0

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
      .eq('site_id', staff.site_id)
      .order('created_at', { ascending: false })
      .limit(5)
    const { data: msgData } = await msgQuery

    const unread = (msgData || []).filter(m => !m.read_by?.includes(staff.id))
    setUrgentMessages(unread)
    onUnreadUrgent?.(unread.length)

    setStats({ completed, flagged, openIssues, inProgress })
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

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-number" style={{ color: 'var(--success)' }}>{stats.completed}</div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ color: 'var(--danger)' }}>{stats.flagged}</div>
          <div className="stat-label">Flagged</div>
        </div>
        <button className="stat-card" onClick={() => onNavigate?.('issues')} style={{
          cursor: stats.openIssues > 0 ? 'pointer' : 'default',
          border: stats.openIssues > 0 ? '1.5px solid rgba(217,79,79,0.3)' : '1px solid var(--border)',
          background: stats.openIssues > 0 ? 'var(--danger-bg)' : 'var(--white)',
        }}>
          <div className="stat-number" style={{ color: stats.openIssues > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
            {stats.openIssues}
          </div>
          <div className="stat-label">Open</div>
        </button>
        <button className="stat-card" onClick={() => onNavigate?.('issues')} style={{
          cursor: stats.inProgress > 0 ? 'pointer' : 'default',
          border: stats.inProgress > 0 ? '1.5px solid rgba(232,144,26,0.3)' : '1px solid var(--border)',
          background: stats.inProgress > 0 ? 'var(--warning-bg)' : 'var(--white)',
        }}>
          <div className="stat-number" style={{ color: stats.inProgress > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>
            {stats.inProgress}
          </div>
          <div className="stat-label">In Prog.</div>
        </button>
      </div>

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
    </div>
  )
}
