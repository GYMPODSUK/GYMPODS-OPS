import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../lib/permissions'
import SiteTasksModal from './SiteTasksModal'

export default function HQOverview({ onNavigate }) {
  const { staff, switchSite } = useAuth()
  const isRegionMgr = staff?.role === ROLES.REGION_MANAGER
  const myRegionId  = staff?.region_id || null

  const [regions, setRegions] = useState([])
  const [sites, setSites] = useState([])
  const [siteStats, setSiteStats] = useState({})
  const [urgentMessages, setUrgentMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [tasksSite, setTasksSite] = useState(null)   // site whose task drill-down is open
  const today = new Date().toISOString().split('T')[0]

  // Load sites + regions + per-site stats.
  // Region Managers see only their region's sites; HQ sees everything.
  const loadAll = useCallback(async () => {
    let sitesQ = supabase.from('sites').select('*, regions(name)').eq('active', true).order('name')
    if (isRegionMgr && myRegionId) sitesQ = sitesQ.eq('region_id', myRegionId)

    let regionsQ = supabase.from('regions').select('*').order('name')
    if (isRegionMgr && myRegionId) regionsQ = regionsQ.eq('id', myRegionId)

    const [{ data: siteData }, { data: regionData }] = await Promise.all([sitesQ, regionsQ])
    setSites(siteData || [])
    setRegions(regionData || [])

    if (siteData?.length) {
      const stats = {}
      for (const site of siteData) {
        const [
          { data: comp }, { data: issues }, { data: urgent }, { data: shiftTasks },
          { count: complaintsCount }, { count: incidentsCount }, { count: lostFoundCount },
          { count: visitorsCount }, { count: notesCount },
        ] = await Promise.all([
          supabase.from('task_completions').select('status').eq('site_id', site.id).eq('date', today),
          supabase.from('issues').select('id').eq('site_id', site.id).eq('status', 'open'),
          supabase.from('messages').select('id').eq('site_id', site.id)
            .eq('priority', 'urgent').eq('resolved', false),
          supabase.from('shift_tasks').select('id, shift_definitions!inner(site_id)')
            .eq('shift_definitions.site_id', site.id),
          supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'open'),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'open'),
          supabase.from('lost_found').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'unclaimed'),
          supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'on_site'),
          supabase.from('notes').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'open'),
        ])
        stats[site.id] = {
          completed:  comp?.filter(c => c.status === 'completed').length || 0,
          flagged:    comp?.filter(c => c.status === 'flagged').length || 0,
          openIssues: issues?.length || 0,
          urgent:     urgent?.length || 0,
          totalTasks: shiftTasks?.length || 0,
          complaints: complaintsCount || 0,
          incidents:  incidentsCount || 0,
          lostFound:  lostFoundCount || 0,
          visitors:   visitorsCount || 0,
          notes:      notesCount || 0,
        }
      }
      setSiteStats(stats)
    } else {
      setSiteStats({})
    }
  }, [today, isRegionMgr, myRegionId])

  // Urgent messages — scoped by region for Region Mgrs, all sites for HQ
  const loadUrgentMessages = useCallback(async () => {
    let q = supabase
      .from('messages')
      .select('*, sites!inner(name, region_id), staff:staff_id(first_name, last_name)')
      .eq('priority', 'urgent')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(20)
    if (isRegionMgr && myRegionId) q = q.eq('sites.region_id', myRegionId)
    const { data } = await q
    setUrgentMessages(data || [])
  }, [isRegionMgr, myRegionId])

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadAll(), loadUrgentMessages()])
      setLoading(false)
    })()
  }, [loadAll, loadUrgentMessages])

  // === REAL-TIME SUBSCRIPTIONS ===
  // Refresh stats + urgent feed whenever issues, task_completions, or
  // messages change anywhere relevant.
  useEffect(() => {
    const channel = supabase
      .channel('hq-network-live')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        () => loadAll())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_completions' },
        () => loadAll())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => { loadAll(); loadUrgentMessages() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' },  () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_found' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' },   () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' },      () => loadAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadAll, loadUrgentMessages])

  const handleOpenSite = async (siteId) => {
    await switchSite(siteId)
    onNavigate?.('dashboard')   // drop into that gym's Home
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div className="spinner" />
      <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Loading network…</div>
    </div>
  )

  const sitesByRegion = regions.map(r => ({
    ...r, sites: sites.filter(s => s.region_id === r.id),
  }))
  const unassigned = sites.filter(s => !s.region_id)

  // Title varies by role
  const title    = isRegionMgr ? 'Region Overview' : 'Network Overview'
  const subtitle = isRegionMgr
    ? `${sites.length} ${sites.length === 1 ? 'site' : 'sites'} in your region`
    : `${sites.length} ${sites.length === 1 ? 'site' : 'sites'} across ${sitesByRegion.filter(r => r.sites.length > 0).length} ${sitesByRegion.filter(r => r.sites.length > 0).length === 1 ? 'region' : 'regions'}`

  return (
    <div className="page-content">
      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -6 }}>
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        {' · '}{subtitle}
      </div>

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
            🔴 {urgentMessages.length} urgent {urgentMessages.length === 1 ? 'alert' : 'alerts'}
            {isRegionMgr ? ' in your region' : ' across the network'}
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
            <SiteCard key={site.id} site={site} stats={siteStats[site.id] || {}} onOpen={handleOpenSite} onViewTasks={setTasksSite} />
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
            <SiteCard key={site.id} site={site} stats={siteStats[site.id] || {}} onOpen={handleOpenSite} onViewTasks={setTasksSite} />
          ))}
        </div>
      )}

      {/* Only show "Expansion regions" footer to HQ — Region Mgrs don't need it */}
      {!isRegionMgr && sitesByRegion.filter(r => r.sites.length === 0).length > 0 && (
        <div style={{ marginTop: 20, padding: 12, background: 'var(--off-white)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
            Expansion regions
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {sitesByRegion.filter(r => r.sites.length === 0).map(r => r.name).join(' · ')}
          </div>
        </div>
      )}

      {tasksSite && <SiteTasksModal site={tasksSite} onClose={() => setTasksSite(null)} />}
    </div>
  )
}

function SiteCard({ site, stats, onOpen, onViewTasks }) {
  const s = stats
  const total = (s.completed || 0) + (s.flagged || 0)
  const pct = s.totalTasks > 0 ? Math.round((total / s.totalTasks) * 100) : 0
  const hasUrgent = (s.urgent || 0) > 0

  // Live "needs attention" signals — only non-zero ones are shown.
  const chips = [
    { n: s.openIssues, label: 'Issues',       color: 'var(--danger)',    bg: 'var(--danger-bg)'  },
    { n: s.complaints, label: 'Complaints',   color: 'var(--danger)',    bg: 'var(--danger-bg)'  },
    { n: s.incidents,  label: 'Incidents',    color: 'var(--warning)',   bg: 'var(--warning-bg)' },
    { n: s.flagged,    label: 'Flagged',      color: 'var(--warning)',   bg: 'var(--warning-bg)' },
    { n: s.lostFound,  label: 'Lost & Found', color: 'var(--warning)',   bg: 'var(--warning-bg)' },
    { n: s.notes,      label: 'Notes',        color: 'var(--navy)',      bg: 'var(--aqua-light)' },
    { n: s.visitors,   label: 'On site',      color: 'var(--aqua-dark)', bg: 'var(--aqua-light)' },
  ].filter(c => (c.n || 0) > 0)

  return (
    <div
      className="site-overview-card"
      style={{
        width: '100%', textAlign: 'left',
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

      {/* Attention chips */}
      {chips.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {chips.map(c => (
            <span key={c.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: c.bg, color: c.color, fontWeight: 700, fontSize: 12,
              padding: '4px 10px', borderRadius: 20,
            }}>
              <span style={{
                background: c.color, color: '#fff', borderRadius: 10, minWidth: 16,
                height: 16, padding: '0 4px', fontSize: 11, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
              }}>{c.n}</span>
              {c.label}
            </span>
          ))}
        </div>
      ) : (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
          color: 'var(--success)', fontWeight: 700, fontSize: 13,
        }}>✓ All clear</div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {total} of {s.totalTasks || 0} tasks completed today ({pct}%)
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => onViewTasks(site)}>
          Today's tasks
        </button>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onOpen(site.id)}>
          Open site ›
        </button>
      </div>
    </div>
  )
}
