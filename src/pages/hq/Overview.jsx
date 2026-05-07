import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function HQOverview() {
  const [sites, setSites] = useState([])
  const [siteStats, setSiteStats] = useState({})
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: siteData } = await supabase.from('sites').select('*').eq('active', true).order('name')
    setSites(siteData || [])

    if (siteData?.length) {
      const stats = {}
      for (const site of siteData) {
        const { data: comp } = await supabase
          .from('task_completions').select('status').eq('site_id', site.id).eq('date', today)
        const { data: issues } = await supabase
          .from('issues').select('id').eq('site_id', site.id).eq('status', 'open')
        const { data: shiftTasks } = await supabase
          .from('shift_tasks').select('id, shift_definitions!inner(site_id)')
          .eq('shift_definitions.site_id', site.id)

        stats[site.id] = {
          completed: comp?.filter(c => c.status === 'completed').length || 0,
          flagged: comp?.filter(c => c.status === 'flagged').length || 0,
          openIssues: issues?.length || 0,
          totalTasks: shiftTasks?.length || 0,
        }
      }
      setSiteStats(stats)
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div className="spinner" />
      <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Loading network…</div>
    </div>
  )

  return (
    <div className="page-content">
      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>Network Overview</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -6 }}>
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>

      {sites.map(site => {
        const s = siteStats[site.id] || {}
        const total = s.completed + s.flagged || 0
        const pct = s.totalTasks > 0 ? Math.round((total / s.totalTasks) * 100) : 0

        return (
          <div key={site.id} className="site-overview-card">
            <div className="site-overview-name">{site.name}</div>
            {site.address && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -8, marginBottom: 12 }}>
                {site.address}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              <div className="stat-card">
                <div className="stat-number" style={{ fontSize: 20, color: 'var(--success)' }}>{s.completed || 0}</div>
                <div className="stat-label">Done</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{ fontSize: 20, color: 'var(--danger)' }}>{s.flagged || 0}</div>
                <div className="stat-label">Flagged</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{ fontSize: 20, color: 'var(--warning)' }}>{s.openIssues || 0}</div>
                <div className="stat-label">Issues</div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {total} of {s.totalTasks || 0} total tasks completed today ({pct}%)
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
