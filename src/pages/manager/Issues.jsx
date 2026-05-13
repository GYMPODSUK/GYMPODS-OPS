import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_FILTERS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'all',         label: 'All' },
]

export default function Issues() {
  const { staff, isHQ } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [issueImages, setIssueImages] = useState([])
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [toast, setToast] = useState(null)

  // Site this view is scoped to. HQ/Region Mgr use active_site_id (the
  // site they're currently viewing); regular staff fall back to site_id.
  const scopedSiteId = staff.active_site_id || staff.site_id

  useEffect(() => { loadIssues() }, [filter])

  // === REALTIME SYNC (the fix for the dashboard duplication bug) ===
  // When any admin updates an issue at this site, every admin's
  // dashboard re-fetches within ~1s — no more stale "still open"
  // items after a colleague resolves something.
  useEffect(() => {
    if (!scopedSiteId && !isHQ()) return

    const filterClause = isHQ() ? undefined : `site_id=eq.${scopedSiteId}`

    const channel = supabase
      .channel(`issues-sync-${scopedSiteId || 'hq'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues', ...(filterClause ? { filter: filterClause } : {}) },
        () => loadIssues()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedSiteId, filter])

  const loadIssues = async () => {
    setLoading(true)
    let q = supabase
      .from('issues')
      .select(`
        *,
        reporter:staff_id ( first_name, last_name ),
        sites:site_id ( name ),
        resolver:resolved_by ( first_name, last_name ),
        claimer:claimed_by ( first_name, last_name )
      `)
      .order('created_at', { ascending: false })

    if (filter !== 'all') q = q.eq('status', filter)
    // HQ sees all sites; everyone else sees only their scoped site
    if (!isHQ()) q = q.eq('site_id', scopedSiteId)

    const { data, error } = await q
    if (error) console.error('Issues query error:', error)
    setIssues(data || [])
    setLoading(false)
  }

  const openIssue = async (issue) => {
    setSelectedIssue(issue)
    setIssueImages([])
    const { data } = await supabase
      .from('issue_images').select('*').eq('issue_id', issue.id)
    setIssueImages(data || [])
  }

  const updateStatus = async (newStatus) => {
    setUpdatingStatus(true)
    const update = { status: newStatus }
    if (newStatus === 'resolved') {
      update.resolved_by = staff.id
      update.resolved_at = new Date().toISOString()
    } else if (newStatus === 'in_progress') {
      update.claimed_by = staff.id
      update.claimed_at = new Date().toISOString()
    }
    const { error } = await supabase.from('issues').update(update).eq('id', selectedIssue.id)
    if (!error) {
      setSelectedIssue(prev => ({ ...prev, ...update }))
      showToast(newStatus === 'resolved' ? 'Issue resolved ✓' : 'Status updated')
      // No need to manually call loadIssues — the realtime subscription
      // above will pick this up and refresh, including for other admins
      // logged in at this site.
    }
    setUpdatingStatus(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const statusColor = { open: 'var(--danger)', in_progress: 'var(--warning)', resolved: 'var(--success)' }
  const statusBg = { open: 'var(--danger-bg)', in_progress: 'var(--warning-bg)', resolved: 'var(--success-bg)' }

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Fixed header */}
        <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '14px 16px 0', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)', marginBottom: 10 }}>Issues</div>
          <div style={{ display: 'flex', gap: 6, paddingBottom: 12 }}>
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                background: filter === f.value ? 'var(--navy)' : 'var(--off-white)',
                color: filter === f.value ? 'var(--white)' : 'var(--text-secondary)',
                border: `1px solid ${filter === f.value ? 'var(--navy)' : 'var(--border)'}`,
              }}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Scrollable issue list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          {issues.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{filter === 'open' ? '✓' : '📋'}</div>
              <div className="empty-state-text">
                {filter === 'open' ? 'No open issues — everything is good!' : 'No issues found.'}
              </div>
            </div>
          ) : (
            issues.map(issue => (
              <button key={issue.id} onClick={() => openIssue(issue)} style={{
                width: '100%', textAlign: 'left', background: 'var(--white)',
                border: `1.5px solid ${statusBg[issue.status] ? statusColor[issue.status] + '44' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', padding: '14px',
                cursor: 'pointer', display: 'flex', alignItems: 'flex-start',
                gap: 12, marginBottom: 8,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                  background: statusColor[issue.status] || 'var(--text-light)'
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                    {issue.task_name || 'Issue reported'}
                  </div>
                  {issue.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                      {issue.description}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 5 }}>
                    {issue.reporter?.first_name} {issue.reporter?.last_name}
                    {isHQ() && issue.sites && ` · ${issue.sites.name}`}
                    {' · '}{timeAgo(issue.created_at)}
                    {issue.claimer && issue.status === 'in_progress' &&
                      ` · Claimed by ${issue.claimer.first_name}`}
                  </div>
                </div>
                <div>
                  <span className={`badge badge-${issue.status}`}>
                    {issue.status === 'in_progress' ? 'In Progress'
                      : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                  </span>
                  <div style={{ fontSize: 18, color: 'var(--text-light)', textAlign: 'center', marginTop: 6 }}>›</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Issue detail modal */}
      {selectedIssue && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedIssue(null)}>
          <div className="modal-sheet" style={{ maxHeight: '85vh' }}>
            <div className="modal-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--navy)', lineHeight: 1.3 }}>
                  {selectedIssue.task_name || 'Issue reported'}
                </div>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: statusBg[selectedIssue.status] || '#eee',
                color: statusColor[selectedIssue.status] || '#888',
                flexShrink: 0
              }}>
                {selectedIssue.status === 'in_progress' ? 'In Progress'
                  : selectedIssue.status.charAt(0).toUpperCase() + selectedIssue.status.slice(1)}
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Reported {formatDate(selectedIssue.created_at)}
              {selectedIssue.reporter && ` by ${selectedIssue.reporter.first_name} ${selectedIssue.reporter.last_name}`}
              {isHQ() && selectedIssue.sites && ` · ${selectedIssue.sites.name}`}
            </div>

            {selectedIssue.description && (
              <div style={{ background: 'var(--off-white)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {selectedIssue.description}
                </div>
              </div>
            )}

            {issueImages.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Photos ({issueImages.length})
                </div>
                <div className="image-preview-grid">
                  {issueImages.map(img => (
                    <img key={img.id} src={img.image_url} className="image-preview" alt="Issue"
                      onClick={() => window.open(img.image_url, '_blank')}
                      style={{ cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            )}

            {selectedIssue.status === 'in_progress' && selectedIssue.claimer && (
              <div style={{ background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 600 }}>
                  🔧 Being handled by {selectedIssue.claimer.first_name} {selectedIssue.claimer.last_name}
                </div>
              </div>
            )}

            {selectedIssue.status === 'resolved' && selectedIssue.resolved_at && (
              <div style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                  ✓ Resolved {formatDate(selectedIssue.resolved_at)}
                  {selectedIssue.resolver && ` by ${selectedIssue.resolver.first_name} ${selectedIssue.resolver.last_name}`}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedIssue.status === 'open' && (
                <button className="btn" onClick={() => updateStatus('in_progress')} disabled={updatingStatus} style={{
                  background: 'var(--warning-bg)', color: 'var(--warning)',
                  border: '1px solid rgba(232,144,26,0.2)'
                }}>
                  {updatingStatus ? 'Updating…' : '🔧 Mark In Progress'}
                </button>
              )}
              {selectedIssue.status !== 'resolved' && (
                <button className="btn btn-success" onClick={() => updateStatus('resolved')} disabled={updatingStatus}>
                  {updatingStatus ? 'Resolving…' : '✓ Mark Resolved'}
                </button>
              )}
              {selectedIssue.status === 'resolved' && (
                <button className="btn btn-outline" onClick={() => updateStatus('open')} disabled={updatingStatus}>
                  Reopen Issue
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedIssue(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
