import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function HQOverview() {
  const { switchSite } = useAuth()
  const [regions, setRegions] = useState([])
  const [sites, setSites] = useState([])
  const [siteStats, setSiteStats] = useState({})
  const [urgentMessages, setUrgentMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadData() }, [])

  // Live refresh of urgent messages across the network
  useEffect(() => {
    const channel = supabase
      .channel('hq-urgent-feed')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => loadUrgentMessages())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const loadData = async () => {
    setLoading(true)

    // Sites + regions in parallel
    const [{ data: siteData }, { data: regionData }] = await Promise.all([
      supabase.from('sites').select('*, regions(name)').eq('active', true).order('name'),
      supabase.from('regions').select('*').order('name'),
    ])

    setSites(siteData || [])
    setRegions(regionData || [])

    if (siteData?.length) {
      const stats = {}
      for (const site of siteData) {
        const { data: comp } = await supabase
          .from('task_completions').select('status').eq('site_id', site.id).eq('date', today)
        const { data: issues } = await supabase
          .from('issues').select('id').eq('site_id', site.id).eq('status', 'open')
        const { data: urgent } = await supabase
          .from('messages').select('id').eq('site_id', site.id)
          .eq('priority', 'urgent').eq('resolved', false)
        const { data: shiftTasks } = await supabase
          .from('shift_tasks').select('id, shift_definitions!inner(site_id)')
          .eq('shift_definitions.site_id', site.id)
        stats[site.id] = {
          completed:  comp?.filter(c => c.status === 'completed').length || 0,
          flagged:    comp?.filter(c => c.status === 'flagged').length || 0,
          openIssues: issues?.length || 0,
          urgent:     urgent?.length || 0,
          totalTasks: shiftTasks?.length || 0,
        }
      }
      setSiteStats(stats)
    }

    await loadUrgentMessages()
    setLoading(false)
  }

  const loadUrgentMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sites(name), staff:staff_id(first_name, last_name)')
      .eq('priority', 'urgent')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(20)
    setUrgentMessages(data || [])
  }

  const handleOpenSite = async (siteId) => {
    await switchSite(siteId)
    // After switchSite, App.jsx remounts with the new active site context.
    // To land them on Messages or Issues we'd need a navigation event;
    // for now, returning to the network view + the picker in App is enough.
    // (Phase 2: add an onNavigate callback to surface the site's Messages page.)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div className="spinner" />
      <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Loading network…</div>
    </div>
  )

  // Group sites by region; sites with no region appear under "Unassigned"
  const sitesByRegion = regions.map(r => ({
    ...r,
    sites: sites.filter(s => s.region_id === r.id),
  }))
  const unassigned = sites.filter(s => !s.region_id)

  return (
    <div className="page-content">
      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>Network Overview</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -6 }}>
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        {' · '}{sites.length} {sites.length === 1 ? 'site' : 'sites'} across {sitesByRegion.filter(r => r.sites.length > 0).length} {sitesByRegion.filter(r => r.sites.length > 0).length === 1 ? 'region' : 'regions'}
      </div>

      {/* Urgent feed — only shown when there's something to act on */}
      {urgentMessages.length > 0 && (
        <div style={{
          background: 'rgba(232,48,26,0.06)',
          border: '1px solid rgba(232,48,26,0.2)',
          borderLeft: '4px solid #E8301A',
          borderRadius: 'var(--radius-md)',
          padding: 14,
          marginTop: 4,
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#E8301A', marginBottom: 10 }}>
            🔴 {urgentMessages.length} urgent {urgentMessages.length === 1 ? 'alert' : 'alerts'} across the network
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {urgentMessages.slice(0, 5).map(m => (
              <button key={m.id} onClick={() => handleOpenSite(m.site_id)} style={{
                background: 'var(--white)',
                border: '1px solid rgba(232,48,26,0.15)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {m.sites?.name?.toUpperCase()} — {m.title}
                  </div>
                  {m.body && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.body}
                    </div>
                  )}
                </div>
                <span style={{ color: 'var(--text-light)', fontSize: 18, flexShrink: 0 }}>›</span>
              </button>
            ))}
            {urgentMessages.length > 5 && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 2 }}>
                + {urgentMessages.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sites grouped by region */}
      {sitesByRegion.filter(r => r.sites.length > 0).map(region => (
        <div key={region.id} style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: 'var(--navy)',
            textTransform: 'uppercase', letterSpacing: '1px',
            marginBottom: 10, paddingTop: 4,
            display: 'flex', alignItems: 'baseline', gap: 8,
          }}>
            {region.name}
            <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>
              {region.sites.length} {region.sites.length === 1 ? 'site' : 'sites'}
            </span>
          </div>
          {region.sites.map(site => (
            <SiteCard key={site.id} site={site} stats={siteStats[site.id] || {}} onOpen={handleOpenSite} />
          ))}
        </div>
      ))}

      {unassigned.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10,
          }}>Unassigned</div>
          {unassigned.map(site => (
            <SiteCard key={site.id} site={site} stats={siteStats[site.id] || {}} onOpen={handleOpenSite} />
          ))}
        </div>
      )}

      {/* Empty regions (e.g. Dubai before any sites exist) — quietly listed for franchise positioning */}
      {sitesByRegion.filter(r => r.sites.length === 0).length > 0 && (
        <div style={{ marginTop: 20, padding: 12, background: 'var(--off-white)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
            Expansion regions
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {sitesByRegion.filter(r => r.sites.length === 0).map(r => r.name).join(' · ')}
          </div>
        </div>
      )}
    </div>
  )
}

function SiteCard({ site, stats, onOpen }) {
  const s = stats
  const total = (s.completed || 0) + (s.flagged || 0)
  const pct = s.totalTasks > 0 ? Math.round((total / s.totalTasks) * 100) : 0
  const hasUrgent = (s.urgent || 0) > 0

  return (
    <button
      onClick={() => onOpen(site.id)}
      className="site-overview-card"
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        border: hasUrgent ? '1px solid rgba(232,48,26,0.3)' : undefined,
        background: hasUrgent ? 'rgba(232,48,26,0.03)' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="site-overview-name">{site.name}</div>
        {hasUrgent && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: '#E8301A',
            background: 'rgba(232,48,26,0.1)', padding: '2px 8px', borderRadius: 10,
          }}>
            ● {s.urgent} URGENT
          </span>
        )}
      </div>
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
    </button>
  )
}
