import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useT, useLanguage } from '../../lib/i18n'
import { TranslatedText, translateText } from '../../lib/translate'

const STATUS_FILTERS = ['open', 'in_progress', 'resolved', 'all']

// Issues wording in all five languages. Issue titles (task names) and the
// descriptions staff typed are translated live.
const TEXT = {
  en: { title: 'Issues', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', all: 'All',
        none_open: 'No open issues — everything is good!', none: 'No issues found.', issue: 'Issue reported',
        claimed_by: ' · Claimed by {name}', reported: 'Reported {date}', by: ' by {name}', description: 'Description',
        photos: 'Photos ({n})', handled_by: 'Being handled by {name}', resolved_on: 'Resolved {date}',
        updating: 'Updating…', resolving: 'Resolving…', mark_in_progress: 'Mark In Progress', mark_resolved: 'Mark Resolved',
        reopen: 'Reopen Issue', close: 'Close', toast_resolved: 'Issue resolved ✓', toast_updated: 'Status updated',
        mins_ago: '{n}m ago', hrs_ago: '{n}h ago', days_ago: '{n}d ago' },
  fr: { title: 'Problèmes', open: 'Ouverts', in_progress: 'En cours', resolved: 'Résolus', all: 'Tous',
        none_open: 'Aucun problème en cours — tout va bien !', none: 'Aucun problème trouvé.', issue: 'Problème signalé',
        claimed_by: ' · Pris en charge par {name}', reported: 'Signalé le {date}', by: ' par {name}', description: 'Description',
        photos: 'Photos ({n})', handled_by: 'Pris en charge par {name}', resolved_on: 'Résolu le {date}',
        updating: 'Mise à jour…', resolving: 'Résolution…', mark_in_progress: 'Passer en cours', mark_resolved: 'Marquer comme résolu',
        reopen: 'Rouvrir le problème', close: 'Fermer', toast_resolved: 'Problème résolu ✓', toast_updated: 'Statut mis à jour',
        mins_ago: 'il y a {n} min', hrs_ago: 'il y a {n} h', days_ago: 'il y a {n} j' },
  es: { title: 'Incidencias', open: 'Abiertas', in_progress: 'En curso', resolved: 'Resueltas', all: 'Todas',
        none_open: 'No hay incidencias abiertas: ¡todo en orden!', none: 'No se han encontrado incidencias.', issue: 'Incidencia informada',
        claimed_by: ' · Asignada a {name}', reported: 'Informada el {date}', by: ' por {name}', description: 'Descripción',
        photos: 'Fotos ({n})', handled_by: 'La está gestionando {name}', resolved_on: 'Resuelta el {date}',
        updating: 'Actualizando…', resolving: 'Resolviendo…', mark_in_progress: 'Marcar en curso', mark_resolved: 'Marcar como resuelta',
        reopen: 'Reabrir incidencia', close: 'Cerrar', toast_resolved: 'Incidencia resuelta ✓', toast_updated: 'Estado actualizado',
        mins_ago: 'hace {n} min', hrs_ago: 'hace {n} h', days_ago: 'hace {n} d' },
  it: { title: 'Problemi', open: 'Aperti', in_progress: 'In corso', resolved: 'Risolti', all: 'Tutti',
        none_open: 'Nessun problema aperto — tutto a posto!', none: 'Nessun problema trovato.', issue: 'Problema segnalato',
        claimed_by: ' · Preso in carico da {name}', reported: 'Segnalato il {date}', by: ' da {name}', description: 'Descrizione',
        photos: 'Foto ({n})', handled_by: 'Se ne sta occupando {name}', resolved_on: 'Risolto il {date}',
        updating: 'Aggiornamento…', resolving: 'Risoluzione…', mark_in_progress: 'Segna in corso', mark_resolved: 'Segna come risolto',
        reopen: 'Riapri problema', close: 'Chiudi', toast_resolved: 'Problema risolto ✓', toast_updated: 'Stato aggiornato',
        mins_ago: '{n} min fa', hrs_ago: '{n} h fa', days_ago: '{n} g fa' },
  pt: { title: 'Problemas', open: 'Abertos', in_progress: 'Em curso', resolved: 'Resolvidos', all: 'Todos',
        none_open: 'Sem problemas em aberto — está tudo bem!', none: 'Nenhum problema encontrado.', issue: 'Problema assinalado',
        claimed_by: ' · A cargo de {name}', reported: 'Assinalado a {date}', by: ' por {name}', description: 'Descrição',
        photos: 'Fotografias ({n})', handled_by: 'A ser tratado por {name}', resolved_on: 'Resolvido a {date}',
        updating: 'A atualizar…', resolving: 'A resolver…', mark_in_progress: 'Marcar em curso', mark_resolved: 'Marcar como resolvido',
        reopen: 'Reabrir problema', close: 'Fechar', toast_resolved: 'Problema resolvido ✓', toast_updated: 'Estado atualizado',
        mins_ago: 'há {n} min', hrs_ago: 'há {n} h', days_ago: 'há {n} d' },
}

export default function Issues({ onNavigate }) {
  const { staff, isHQ } = useAuth()
  const t = useT(TEXT)
  const { lang, locale } = useLanguage()
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

  // Issue titles are task names typed in English — translate for other languages.
  const [tx, setTx] = useState({})
  const tr = (x) => (x && tx[x]) || x
  useEffect(() => {
    if (lang === 'en') { setTx({}); return }
    const texts = [...new Set(issues.map(i => i.task_name).filter(x => x && x.trim()))]
    if (texts.length === 0) return
    let alive = true
    Promise.all(texts.map(x => translateText(x, lang).then(r => [x, r?.text])))
      .then(pairs => { if (alive) setTx(Object.fromEntries(pairs.filter(([, v]) => v))) })
    return () => { alive = false }
  }, [lang, issues])

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
        reporter:staff_id ( first_name, last_name, language ),
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
      showToast(newStatus === 'resolved' ? t('toast_resolved') : t('toast_updated'))
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
    if (mins < 60) return t('mins_ago', { n: mins })
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return t('hrs_ago', { n: hrs })
    return t('days_ago', { n: Math.floor(hrs / 24) })
  }

  const formatDate = (ts) => new Date(ts).toLocaleDateString(locale, {
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
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)', marginBottom: 10 }}>{t('title')}</div>
          <div style={{ display: 'flex', gap: 6, paddingBottom: 12 }}>
            {STATUS_FILTERS.map(v => ({ value: v, label: t(v) })).map(f => (
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
                {filter === 'open' ? t('none_open') : t('none')}
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
                    {tr(issue.task_name) || t('issue')}
                  </div>
                  {issue.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                      <TranslatedText text={issue.description} authorLang={issue.reporter?.language} compact />
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 5 }}>
                    {issue.reporter?.first_name} {issue.reporter?.last_name}
                    {isHQ() && issue.sites && ` · ${issue.sites.name}`}
                    {' · '}{timeAgo(issue.created_at)}
                    {issue.claimer && issue.status === 'in_progress' &&
                      t('claimed_by', { name: issue.claimer.first_name })}
                  </div>
                </div>
                <div>
                  <span className={`badge badge-${issue.status}`}>
                    {t(issue.status)}
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
                  {tr(selectedIssue.task_name) || t('issue')}
                </div>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: statusBg[selectedIssue.status] || '#eee',
                color: statusColor[selectedIssue.status] || '#888',
                flexShrink: 0
              }}>
                {t(selectedIssue.status)}
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {t('reported', { date: formatDate(selectedIssue.created_at) })}
              {selectedIssue.reporter && t('by', { name: `${selectedIssue.reporter.first_name} ${selectedIssue.reporter.last_name}` })}
              {isHQ() && selectedIssue.sites && ` · ${selectedIssue.sites.name}`}
            </div>

            {selectedIssue.description && (
              <div style={{ background: 'var(--off-white)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('description')}</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  <TranslatedText text={selectedIssue.description} authorLang={selectedIssue.reporter?.language} />
                </div>
              </div>
            )}

            {issueImages.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('photos', { n: issueImages.length })}
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
                  🔧 {t('handled_by', { name: `${selectedIssue.claimer.first_name} ${selectedIssue.claimer.last_name}` })}
                </div>
              </div>
            )}

            {selectedIssue.status === 'resolved' && selectedIssue.resolved_at && (
              <div style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                  ✓ {t('resolved_on', { date: formatDate(selectedIssue.resolved_at) })}
                  {selectedIssue.resolver && t('by', { name: `${selectedIssue.resolver.first_name} ${selectedIssue.resolver.last_name}` })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedIssue.status === 'open' && (
                <button className="btn" onClick={() => updateStatus('in_progress')} disabled={updatingStatus} style={{
                  background: 'var(--warning-bg)', color: 'var(--warning)',
                  border: '1px solid rgba(232,144,26,0.2)'
                }}>
                  {updatingStatus ? t('updating') : `🔧 ${t('mark_in_progress')}`}
                </button>
              )}
              {selectedIssue.status !== 'resolved' && (
                <button className="btn btn-success" onClick={() => updateStatus('resolved')} disabled={updatingStatus}>
                  {updatingStatus ? t('resolving') : `✓ ${t('mark_resolved')}`}
                </button>
              )}
              {selectedIssue.status === 'resolved' && (
                <button className="btn btn-outline" onClick={() => updateStatus('open')} disabled={updatingStatus}>
                  {t('reopen')}
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedIssue(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
