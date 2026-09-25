import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import NotesPanel from '../notes/NotesPanel'
import SiteTasksModal from '../hq/SiteTasksModal'
import { shiftsRunningOn } from '../../lib/schedule'
import { useT, useLanguage } from '../../lib/i18n'
import { TranslatedText, translateText } from '../../lib/translate'

// Manager Home wording in all five languages. Shift names and issue titles
// (typed by managers) and descriptions (typed by staff) are translated live.
const TEXT = {
  en: {
    overview: "Today's Overview", cover_shift: 'Cover a shift',
    urgent_one: '1 urgent message unread', urgent_many: '{n} urgent messages unread', more: ' +{n} more',
    issues: 'Issues', in_progress: 'In progress', complaints: 'Complaints', incidents: 'Incidents',
    flagged: 'Flagged', lost_found: 'Lost & Found', on_site: 'On site', all_clear: 'All clear',
    tasks_today: '{done} of {total} tasks completed today ({pct}%)',
    view_tasks: "View today's tasks (done & outstanding)",
    complaints_incidents: 'Complaints & incidents', open_forms: 'Open forms',
    kind_Complaint: 'Complaint', kind_Incident: 'Incident',
    sev_low: 'low', sev_medium: 'medium', sev_high: 'high',
    shift_activity: 'Shift activity today', n_done: '{n} done', n_flagged: '{n} flagged',
    open_issues: 'Open issues', view_all: 'View all', no_issues: 'No open issues', issue: 'Issue',
    st_open: 'open', st_in_progress: 'In Prog.',
    mins_ago: '{n}m ago', hrs_ago: '{n}h ago', days_ago: '{n}d ago',
  },
  fr: {
    overview: 'Aperçu du jour', cover_shift: 'Couvrir un service',
    urgent_one: '1 message urgent non lu', urgent_many: '{n} messages urgents non lus', more: ' +{n} autres',
    issues: 'Problèmes', in_progress: 'En cours', complaints: 'Réclamations', incidents: 'Incidents',
    flagged: 'Signalés', lost_found: 'Objets trouvés', on_site: 'Sur place', all_clear: 'Rien à signaler',
    tasks_today: "{done} sur {total} tâches effectuées aujourd'hui ({pct} %)",
    view_tasks: 'Voir les tâches du jour (faites et à faire)',
    complaints_incidents: 'Réclamations et incidents', open_forms: 'Ouvrir les formulaires',
    kind_Complaint: 'Réclamation', kind_Incident: 'Incident',
    sev_low: 'faible', sev_medium: 'moyenne', sev_high: 'élevée',
    shift_activity: "Activité des services aujourd'hui", n_done: '{n} faites', n_flagged: '{n} signalées',
    open_issues: 'Problèmes en cours', view_all: 'Tout voir', no_issues: 'Aucun problème en cours', issue: 'Problème',
    st_open: 'ouvert', st_in_progress: 'En cours',
    mins_ago: 'il y a {n} min', hrs_ago: 'il y a {n} h', days_ago: 'il y a {n} j',
  },
  es: {
    overview: 'Resumen de hoy', cover_shift: 'Cubrir un turno',
    urgent_one: '1 mensaje urgente sin leer', urgent_many: '{n} mensajes urgentes sin leer', more: ' +{n} más',
    issues: 'Incidencias', in_progress: 'En curso', complaints: 'Quejas', incidents: 'Incidentes',
    flagged: 'Con incidencia', lost_found: 'Objetos perdidos', on_site: 'En el centro', all_clear: 'Todo en orden',
    tasks_today: '{done} de {total} tareas completadas hoy ({pct} %)',
    view_tasks: 'Ver las tareas de hoy (hechas y pendientes)',
    complaints_incidents: 'Quejas e incidentes', open_forms: 'Abrir formularios',
    kind_Complaint: 'Queja', kind_Incident: 'Incidente',
    sev_low: 'baja', sev_medium: 'media', sev_high: 'alta',
    shift_activity: 'Actividad de turnos hoy', n_done: '{n} hechas', n_flagged: '{n} con incidencia',
    open_issues: 'Incidencias abiertas', view_all: 'Ver todo', no_issues: 'No hay incidencias abiertas', issue: 'Incidencia',
    st_open: 'abierta', st_in_progress: 'En curso',
    mins_ago: 'hace {n} min', hrs_ago: 'hace {n} h', days_ago: 'hace {n} d',
  },
  it: {
    overview: 'Panoramica di oggi', cover_shift: 'Coprire un turno',
    urgent_one: '1 messaggio urgente non letto', urgent_many: '{n} messaggi urgenti non letti', more: ' +{n} altri',
    issues: 'Problemi', in_progress: 'In corso', complaints: 'Reclami', incidents: 'Incidenti',
    flagged: 'Segnalati', lost_found: 'Oggetti smarriti', on_site: 'In sede', all_clear: 'Tutto a posto',
    tasks_today: '{done} di {total} compiti completati oggi ({pct}%)',
    view_tasks: 'Vedi i compiti di oggi (fatti e da fare)',
    complaints_incidents: 'Reclami e incidenti', open_forms: 'Apri i moduli',
    kind_Complaint: 'Reclamo', kind_Incident: 'Incidente',
    sev_low: 'bassa', sev_medium: 'media', sev_high: 'alta',
    shift_activity: 'Attività dei turni oggi', n_done: '{n} fatti', n_flagged: '{n} segnalati',
    open_issues: 'Problemi aperti', view_all: 'Vedi tutti', no_issues: 'Nessun problema aperto', issue: 'Problema',
    st_open: 'aperto', st_in_progress: 'In corso',
    mins_ago: '{n} min fa', hrs_ago: '{n} h fa', days_ago: '{n} g fa',
  },
  pt: {
    overview: 'Resumo de hoje', cover_shift: 'Cobrir um turno',
    urgent_one: '1 mensagem urgente por ler', urgent_many: '{n} mensagens urgentes por ler', more: ' +{n} mais',
    issues: 'Problemas', in_progress: 'Em curso', complaints: 'Reclamações', incidents: 'Incidentes',
    flagged: 'Assinalados', lost_found: 'Perdidos e achados', on_site: 'No local', all_clear: 'Tudo em ordem',
    tasks_today: '{done} de {total} tarefas concluídas hoje ({pct}%)',
    view_tasks: 'Ver as tarefas de hoje (feitas e por fazer)',
    complaints_incidents: 'Reclamações e incidentes', open_forms: 'Abrir formulários',
    kind_Complaint: 'Reclamação', kind_Incident: 'Incidente',
    sev_low: 'baixa', sev_medium: 'média', sev_high: 'alta',
    shift_activity: 'Atividade dos turnos hoje', n_done: '{n} feitas', n_flagged: '{n} assinaladas',
    open_issues: 'Problemas em aberto', view_all: 'Ver tudo', no_issues: 'Sem problemas em aberto', issue: 'Problema',
    st_open: 'aberto', st_in_progress: 'Em curso',
    mins_ago: 'há {n} min', hrs_ago: 'há {n} h', days_ago: 'há {n} d',
  },
}

// Two-line clamp for descriptions (the whole text is translated, then trimmed on screen).
const CLAMP2 = { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }

export default function Dashboard({ onNavigate, onUnreadUrgent }) {
  const { staff, isHQ } = useAuth()
  const t = useT(TEXT)
  const { lang, locale } = useLanguage()
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

  // Shift names + issue titles are typed in English — translate for other languages.
  const [tx, setTx] = useState({})
  const tr = (x) => (x && tx[x]) || x
  useEffect(() => {
    if (lang === 'en') { setTx({}); return }
    const texts = [...new Set([...shiftSummary.map(([name]) => name), ...recentIssues.map(i => i.task_name)]
      .filter(x => x && x.trim()))]
    if (texts.length === 0) return
    let alive = true
    Promise.all(texts.map(x => translateText(x, lang).then(r => [x, r?.text])))
      .then(pairs => { if (alive) setTx(Object.fromEntries(pairs.filter(([, v]) => v))) })
    return () => { alive = false }
  }, [lang, shiftSummary, recentIssues])

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
    if (mins < 60) return t('mins_ago', { n: mins })
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return t('hrs_ago', { n: hrs })
    return t('days_ago', { n: Math.floor(hrs / 24) })
  }

  // Same signals as the HQ Network card, scoped to this gym. Every chip is
  // tappable and lands on the screen the number came from.
  const doneToday = stats.completed + stats.flagged
  const pct = stats.totalTasks > 0 ? Math.round((doneToday / stats.totalTasks) * 100) : 0
  const chips = [
    { n: stats.openIssues, key: 'issues',       color: 'var(--danger)',    bg: 'var(--danger-bg)',  go: () => onNavigate?.('issues') },
    { n: stats.inProgress, key: 'in_progress',  color: 'var(--warning)',   bg: 'var(--warning-bg)', go: () => onNavigate?.('issues') },
    { n: stats.complaints, key: 'complaints',   color: 'var(--danger)',    bg: 'var(--danger-bg)',  go: () => onNavigate?.('logs', 'complaints') },
    { n: stats.incidents,  key: 'incidents',    color: 'var(--warning)',   bg: 'var(--warning-bg)', go: () => onNavigate?.('logs', 'incidents') },
    { n: stats.flagged,    key: 'flagged',      color: 'var(--warning)',   bg: 'var(--warning-bg)', go: () => setShowTasks(true) },
    { n: stats.lostFound,  key: 'lost_found', color: 'var(--warning)',   bg: 'var(--warning-bg)', go: () => onNavigate?.('logs', 'lost_found') },
    { n: stats.visitors,   key: 'on_site',      color: 'var(--aqua-dark)', bg: 'var(--aqua-light)', go: () => onNavigate?.('logs', 'visitors') },
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
        <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--navy)' }}>{t('overview')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
          {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Standing in on the floor — opens the same shift/task flow staff use,
          but sees every shift and every task at the site, whoever it's normally for. */}
      {staff.role === 'admin' && (
        <button className="btn btn-outline" onClick={() => onNavigate?.('cover-shift')} style={{ width: '100%' }}>
          🧍 {t('cover_shift')}
        </button>
      )}

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
                {urgentMessages.length > 1 ? t('urgent_many', { n: urgentMessages.length }) : t('urgent_one')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                <TranslatedText text={urgentMessages[0]?.title} compact />
                {urgentMessages.length > 1 && t('more', { n: urgentMessages.length - 1 })}
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
              <button key={c.key} onClick={c.go} style={{
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
                {t(c.key)}
                <span style={{ opacity: 0.5, fontSize: 13, marginLeft: 1 }}>›</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14,
            color: 'var(--success)', fontWeight: 700, fontSize: 13,
          }}>✓ {t('all_clear')}</div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {t('tasks_today', { done: doneToday, total: stats.totalTasks, pct })}
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {scopedSiteId && (
          <button className="btn btn-outline btn-sm" onClick={() => setShowTasks(true)}
            style={{ width: '100%', marginTop: 14 }}>
            📋 {t('view_tasks')}
          </button>
        )}
      </div>

      {reports.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>{t('complaints_incidents')}</div>
            <button onClick={() => onNavigate?.('logs')} style={{ fontSize: 12, color: 'var(--aqua)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>{t('open_forms')} ›</button>
          </div>
          {reports.map(r => (
            <button key={r.kind + r.id} onClick={() => onNavigate?.('logs')} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <div className="list-item">
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: r.severity === 'high' ? 'var(--danger)' : r.severity === 'medium' ? 'var(--warning)' : 'var(--text-light)',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t(`kind_${r.kind}`)}{r.severity ? ` · ${t(`sev_${r.severity}`)}` : ''}</div>
                  {r.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3, ...CLAMP2 }}>
                      <TranslatedText text={r.description} compact />
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
          <div className="card-title">{t('shift_activity')}</div>
          {shiftSummary.map(([name, data]) => (
            <div key={name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{tr(name)}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {data.completed > 0 && <span className="badge badge-completed">{t('n_done', { n: data.completed })}</span>}
                  {data.flagged > 0   && <span className="badge badge-flagged">{t('n_flagged', { n: data.flagged })}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Open issues */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>{t('open_issues')}</div>
          {recentIssues.length > 0 && (
            <button onClick={() => onNavigate?.('issues')} style={{
              fontSize: 12, color: 'var(--aqua)', fontWeight: 700,
              background: 'none', border: 'none', cursor: 'pointer'
            }}>{t('view_all')} ›</button>
          )}
        </div>
        {recentIssues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-light)', fontSize: 14 }}>
            ✓ {t('no_issues')}
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
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{tr(issue.task_name) || t('issue')}</div>
                  {issue.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3, ...CLAMP2 }}>
                      <TranslatedText text={issue.description} compact />
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
                    {t(`st_${issue.status}`)}
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
