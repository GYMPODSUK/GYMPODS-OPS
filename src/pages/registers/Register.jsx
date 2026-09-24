// src/pages/registers/Register.jsx
// Shared, config-driven register. Renders any register defined in
// src/lib/registers.js — list, filters, add form, detail view, realtime
// sync and photo upload. Mirrors the Issues + ComposeMessage patterns.
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SEVERITY_OPTIONS } from '../../lib/registers'
import { useT, useLanguage } from '../../lib/i18n'

const STORAGE_BUCKET = 'record-images'

// Screen wording in all five languages. Form names, fields, options and
// statuses come already translated in `config` (see src/lib/registers.js).
// Phrasing avoids "New …/Log …" + noun so it reads right in every language
// (French/Spanish/Italian/Portuguese nouns change the adjective's gender).
const TEXT = {
  en: {
    new: '+ New', all: 'All', this_gym: 'This gym', all_gyms: 'All gyms',
    empty: 'No {label} logged{view}.', empty_view: ' in this view',
    mins_ago: '{n}m ago', hrs_ago: '{n}h ago', days_ago: '{n}d ago',
    logged_on: 'Logged {date}', signed_in: 'Signed in {date}', by: ' by {name}', marked_by: ' · marked by {name}',
    photos_n: 'Photos ({n})', enter_name: 'Enter name…', cancel: 'Cancel', confirm: 'Confirm',
    saving: 'Saving…', updating: 'Updating…', mark: 'Mark {status}', close: 'Close',
    updated: 'Updated ✓', update_failed: 'Update failed', saved: '{item} logged ✓',
    add_title: 'New {item}', log_btn: 'Log {item}', select: 'Select…',
    photos_optional: 'Photos (optional)', photo_tap: 'Tap to take photo or choose from library',
    fill_in: 'Please fill in "{field}"', save_failed: "Couldn't save — {msg}",
    generic_error: 'Something went wrong — please try again',
    photo_warning: "{item} logged, but {n} photo(s) didn't upload",
  },
  fr: {
    new: '+ Nouveau', all: 'Tous', this_gym: 'Cette salle', all_gyms: 'Toutes les salles',
    empty: "Rien d'enregistré ici pour l'instant.", empty_view: '',
    mins_ago: 'il y a {n} min', hrs_ago: 'il y a {n} h', days_ago: 'il y a {n} j',
    logged_on: 'Enregistré le {date}', signed_in: 'Arrivée le {date}', by: ' par {name}', marked_by: ' · noté par {name}',
    photos_n: 'Photos ({n})', enter_name: 'Saisissez le nom…', cancel: 'Annuler', confirm: 'Confirmer',
    saving: 'Enregistrement…', updating: 'Mise à jour…', mark: 'Passer à : {status}', close: 'Fermer',
    updated: 'Mis à jour ✓', update_failed: 'Échec de la mise à jour', saved: 'Enregistrement effectué ✓',
    add_title: 'Ajouter : {item}', log_btn: 'Enregistrer', select: 'Sélectionner…',
    photos_optional: 'Photos (facultatif)', photo_tap: 'Touchez pour prendre une photo ou choisir dans la galerie',
    fill_in: 'Veuillez remplir « {field} »', save_failed: "Impossible d'enregistrer — {msg}",
    generic_error: 'Une erreur est survenue — veuillez réessayer',
    photo_warning: "Enregistré, mais {n} photo(s) n'ont pas été envoyées",
  },
  es: {
    new: '+ Nuevo', all: 'Todos', this_gym: 'Este gimnasio', all_gyms: 'Todos los gimnasios',
    empty: 'Todavía no hay nada registrado aquí.', empty_view: '',
    mins_ago: 'hace {n} min', hrs_ago: 'hace {n} h', days_ago: 'hace {n} d',
    logged_on: 'Registrado el {date}', signed_in: 'Entrada: {date}', by: ' por {name}', marked_by: ' · marcado por {name}',
    photos_n: 'Fotos ({n})', enter_name: 'Escribe el nombre…', cancel: 'Cancelar', confirm: 'Confirmar',
    saving: 'Guardando…', updating: 'Actualizando…', mark: 'Cambiar a: {status}', close: 'Cerrar',
    updated: 'Actualizado ✓', update_failed: 'No se ha podido actualizar', saved: 'Guardado ✓',
    add_title: 'Añadir: {item}', log_btn: 'Registrar', select: 'Seleccionar…',
    photos_optional: 'Fotos (opcional)', photo_tap: 'Toca para hacer una foto o elegir de la galería',
    fill_in: 'Rellena «{field}»', save_failed: 'No se ha podido guardar: {msg}',
    generic_error: 'Algo ha fallado: inténtalo de nuevo',
    photo_warning: 'Guardado, pero {n} foto(s) no se han subido',
  },
  it: {
    new: '+ Nuovo', all: 'Tutti', this_gym: 'Questa palestra', all_gyms: 'Tutte le palestre',
    empty: 'Ancora niente di registrato qui.', empty_view: '',
    mins_ago: '{n} min fa', hrs_ago: '{n} h fa', days_ago: '{n} g fa',
    logged_on: 'Registrato il {date}', signed_in: 'Ingresso: {date}', by: ' da {name}', marked_by: ' · segnato da {name}',
    photos_n: 'Foto ({n})', enter_name: 'Inserisci il nome…', cancel: 'Annulla', confirm: 'Conferma',
    saving: 'Salvataggio…', updating: 'Aggiornamento…', mark: 'Imposta: {status}', close: 'Chiudi',
    updated: 'Aggiornato ✓', update_failed: 'Aggiornamento non riuscito', saved: 'Salvato ✓',
    add_title: 'Aggiungi: {item}', log_btn: 'Registra', select: 'Seleziona…',
    photos_optional: 'Foto (facoltative)', photo_tap: 'Tocca per scattare una foto o scegliere dalla galleria',
    fill_in: 'Compila «{field}»', save_failed: 'Impossibile salvare — {msg}',
    generic_error: 'Qualcosa è andato storto — riprova',
    photo_warning: 'Salvato, ma {n} foto non sono state caricate',
  },
  pt: {
    new: '+ Novo', all: 'Todos', this_gym: 'Este ginásio', all_gyms: 'Todos os ginásios',
    empty: 'Ainda não há nada registado aqui.', empty_view: '',
    mins_ago: 'há {n} min', hrs_ago: 'há {n} h', days_ago: 'há {n} d',
    logged_on: 'Registado a {date}', signed_in: 'Entrada: {date}', by: ' por {name}', marked_by: ' · marcado por {name}',
    photos_n: 'Fotografias ({n})', enter_name: 'Introduza o nome…', cancel: 'Cancelar', confirm: 'Confirmar',
    saving: 'A guardar…', updating: 'A atualizar…', mark: 'Mudar para: {status}', close: 'Fechar',
    updated: 'Atualizado ✓', update_failed: 'Falha na atualização', saved: 'Guardado ✓',
    add_title: 'Adicionar: {item}', log_btn: 'Registar', select: 'Selecionar…',
    photos_optional: 'Fotografias (opcional)', photo_tap: 'Toque para tirar uma fotografia ou escolher da galeria',
    fill_in: 'Preencha «{field}»', save_failed: 'Não foi possível guardar — {msg}',
    generic_error: 'Algo correu mal — tente novamente',
    photo_warning: 'Guardado, mas {n} fotografia(s) não foram carregadas',
  },
}

// ── datetime-local helpers ─────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const nowLocalInput = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const toISO = (localValue) => (localValue ? new Date(localValue).toISOString() : null)

export default function Register({ config, onBack, embedded = false, onChanged }) {
  const { staff, isHQ } = useAuth()
  const t = useT(TEXT)
  const { locale } = useLanguage()
  const sevOptions = config.severityOptions || SEVERITY_OPTIONS
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState(config.statuses[0].value)
  const [selected, setSelected] = useState(null)
  const [detailImages, setDetailImages] = useState([])
  const [showAdd, setShowAdd]   = useState(false)
  const [busy, setBusy]         = useState(false)
  const [toast, setToast]       = useState(null)

  // Collect-prompt state (e.g. Lost & Found "Collected by")
  const [collectValue, setCollectValue] = useState('')
  const [collectingStatus, setCollectingStatus] = useState(null)

  // HQ only: view every gym's records instead of just the one they're in.
  const [allSites, setAllSites] = useState(false)

  const scopedSiteId = staff.active_site_id || staff.site_id
  const siteScoped   = !allSites && !!scopedSiteId

  const showToast = (msg, type = 'success', ms = 2200) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), ms)
  }

  // ── data load ─────────────────────────────────────────────────────
  const loadRecords = async () => {
    setLoading(true)
    // Explicit FK aliases avoid the staff/sites multi-FK embedding gotcha.
    let select = '*, logged:logged_by ( first_name, last_name ), sites:site_id ( name ), actioner:updated_by ( first_name, last_name )'
    if (config.resolveStatus) select += ', resolver:resolved_by ( first_name, last_name )'

    let q = supabase.from(config.table).select(select).order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    if (siteScoped) q = q.eq('site_id', scopedSiteId)

    const { data, error } = await q
    if (error) console.error(`${config.table} query error:`, error)
    setRecords(data || [])
    setLoading(false)
  }

  useEffect(() => { loadRecords() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, config.table, allSites, scopedSiteId])

  // ── realtime sync (same approach as Issues) ───────────────────────
  useEffect(() => {
    if (!scopedSiteId && !isHQ()) return
    const filterClause = siteScoped ? `site_id=eq.${scopedSiteId}` : undefined
    const channel = supabase
      .channel(`${config.table}-sync-${allSites ? 'all' : (scopedSiteId || 'hq')}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: config.table, ...(filterClause ? { filter: filterClause } : {}) },
        () => loadRecords())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedSiteId, filter, config.table, allSites])

  const openRecord = async (rec) => {
    setSelected(rec)
    setCollectingStatus(null)
    setCollectValue('')
    setDetailImages([])
    if (config.hasImages) {
      const { data } = await supabase
        .from('record_images').select('*')
        .eq('record_type', config.recordType).eq('record_id', rec.id)
      setDetailImages(data || [])
    }
  }

  // ── status transitions ────────────────────────────────────────────
  const applyStatus = async (newStatus, extra = {}) => {
    setBusy(true)
    const now = new Date().toISOString()
    // Every status change stamps who did it and when (the "who did and when" log).
    const update = { status: newStatus, updated_by: staff.id, updated_at: now, ...extra }
    if (config.resolveStatus && newStatus === config.resolveStatus) {
      update.resolved_by = staff.id
      update.resolved_at = now
    }
    const { error } = await supabase.from(config.table).update(update).eq('id', selected.id)
    if (!error) {
      const me = { first_name: staff.first_name, last_name: staff.last_name }
      setSelected(prev => ({ ...prev, ...update, actioner: me, ...(update.resolved_by ? { resolver: me } : {}) }))
      setCollectingStatus(null)
      setCollectValue('')
      showToast(t('updated'))
      onChanged?.()
    } else {
      console.error(error); showToast(t('update_failed'), 'error')
    }
    setBusy(false)
  }

  const handleStatusClick = (statusValue) => {
    const p = config.promptOnStatus
    if (p && p.status === statusValue) {
      setCollectingStatus(statusValue)   // show inline prompt instead of updating now
      return
    }
    applyStatus(statusValue)
  }

  const confirmCollect = () => {
    const p = config.promptOnStatus
    const extra = { [p.field]: collectValue.trim() || null }
    if (p.timestampField) extra[p.timestampField] = new Date().toISOString()
    applyStatus(collectingStatus, extra)
  }

  // ── formatting ────────────────────────────────────────────────────
  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (mins < 60) return t('mins_ago', { n: mins })
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return t('hrs_ago', { n: hrs })
    return t('days_ago', { n: Math.floor(hrs / 24) })
  }
  const formatDate = (ts) => new Date(ts).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const formatDateTime = (ts) => new Date(ts).toLocaleString(locale, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  // Registers with showTimes (Visitor book) display time of day on in/out; others are date-only.
  const fmt = config.showTimes ? formatDateTime : formatDate
  const statusMeta   = (v) => config.statuses.find(s => s.value === v) || { label: v, color: 'var(--text-light)', bg: 'var(--off-white)' }
  const severityMeta = (v) => sevOptions.find(s => s.value === v)

  const filters = [...config.statuses, { value: 'all', label: t('all') }]

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '14px 16px 0', flexShrink: 0 }}>
          {!embedded && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {onBack && (
                <button className="btn-icon" onClick={onBack} aria-label="Back" style={{ fontSize: 22, lineHeight: 1 }}>‹</button>
              )}
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)', flex: 1 }}>
                {config.icon} {config.label}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
              {filters.map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                  background: filter === f.value ? 'var(--navy)' : 'var(--off-white)',
                  color: filter === f.value ? 'var(--white)' : 'var(--text-secondary)',
                  border: `1px solid ${filter === f.value ? 'var(--navy)' : 'var(--border)'}`,
                }}>{f.label}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => setShowAdd(true)}>{t('new')}</button>
          </div>

          {/* HQ scope toggle — this gym (default) vs every gym */}
          {isHQ() && scopedSiteId && (
            <div style={{ display: 'flex', gap: 6, paddingBottom: 12 }}>
              {[
                { v: false, label: staff.active_site?.name || t('this_gym') },
                { v: true,  label: t('all_gyms') },
              ].map(o => (
                <button key={String(o.v)} onClick={() => setAllSites(o.v)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                  background: allSites === o.v ? 'var(--aqua-light)' : 'var(--white)',
                  color: allSites === o.v ? 'var(--navy)' : 'var(--text-light)',
                  border: `1px solid ${allSites === o.v ? 'var(--aqua)' : 'var(--border)'}`,
                }}>{o.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><div className="spinner" /></div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{config.icon}</div>
              <div className="empty-state-text">{t('empty', { label: config.label.toLowerCase(), view: filter !== 'all' ? t('empty_view') : '' })}</div>
            </div>
          ) : (
            records.map(rec => {
              const sm = statusMeta(rec.status)
              const sev = config.hasSeverity ? severityMeta(rec.severity) : null
              return (
                <button key={rec.id} onClick={() => openRecord(rec)} style={{
                  width: '100%', textAlign: 'left', background: 'var(--white)',
                  border: `1.5px solid ${sm.color}44`, borderRadius: 'var(--radius-md)',
                  padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: sm.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {rec[config.rowPrimary] || config.singular}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 5 }}>
                      {rec.logged ? `${rec.logged.first_name} ${rec.logged.last_name}` : '—'}
                      {!siteScoped && rec.sites && ` · ${rec.sites.name}`}
                      {' · '}{timeAgo(rec.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {sev && (
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sev.bg, color: sev.color }}>{sev.label}</span>
                    )}
                    <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>{sm.label}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Add form modal */}
      {showAdd && (
        <AddRecordForm config={config} scopedSiteId={scopedSiteId} staffId={staff.id}
          onClose={() => setShowAdd(false)}
          onSaved={(warning) => {
            setShowAdd(false)
            if (warning) showToast(warning, 'error', 6000)
            else showToast(t('saved', { item: config.singular }))
            onChanged?.() /* realtime refreshes list */
          }}
        />
      )}

      {/* Detail modal */}
      {selected && (() => {
        const sm = statusMeta(selected.status)
        const sev = config.hasSeverity ? severityMeta(selected.severity) : null
        return (
          <div className="modal-overlay" style={{ alignItems: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && setSelected(null)}>
            <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', margin: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--navy)', lineHeight: 1.3 }}>
                  {config.icon} {config.singular}
                </div>
                <button onClick={() => setSelected(null)} aria-label={t('close')} style={{
                  background: 'var(--off-white)', border: 'none', borderRadius: '50%', width: 30, height: 30,
                  fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {sev && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sev.bg, color: sev.color }}>{sev.label}</span>}
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>{sm.label}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {t(config.showTimes ? 'signed_in' : 'logged_on', { date: fmt(selected.created_at) })}
                {selected.logged && t('by', { name: `${selected.logged.first_name} ${selected.logged.last_name}` })}
                {!siteScoped && selected.sites && ` · ${selected.sites.name}`}
              </div>

              {/* All configured fields */}
              {config.fields.map(f => {
                const val = selected[f.name]
                if (val === null || val === undefined || val === '') return null
                let display = val
                if (f.type === 'datetime') display = formatDate(val)
                else if (f.type === 'select') display = (f.options.find(o => o.value === val)?.label) || val
                else if (f.type === 'severity') return null // shown as badge above
                // Make email + phone tappable for quick lead follow-up.
                let displayNode = <span style={{ whiteSpace: 'pre-wrap' }}>{display}</span>
                if (f.name === 'email') displayNode = <a href={`mailto:${val}`} style={{ color: 'var(--aqua-dark)', fontWeight: 600 }}>{val}</a>
                else if (f.name === 'phone') displayNode = <a href={`tel:${val}`} style={{ color: 'var(--aqua-dark)', fontWeight: 600 }}>{val}</a>
                return (
                  <div key={f.name} style={{ background: 'var(--off-white)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{displayNode}</div>
                  </div>
                )
              })}

              {/* Photos */}
              {config.hasImages && detailImages.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('photos_n', { n: detailImages.length })}</div>
                  <div className="image-preview-grid">
                    {detailImages.map(img => (
                      <img key={img.id} src={img.image_url} className="image-preview" alt=""
                        onClick={() => window.open(img.image_url, '_blank')} style={{ cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Collected-by / resolved-by summaries */}
              {config.promptOnStatus && selected[config.promptOnStatus.field] && (
                <div style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                    ✓ {config.promptOnStatus.label}: {selected[config.promptOnStatus.field]}
                    {config.promptOnStatus.timestampField && selected[config.promptOnStatus.timestampField] && ` · ${formatDate(selected[config.promptOnStatus.timestampField])}`}
                    {selected.actioner && t('marked_by', { name: `${selected.actioner.first_name} ${selected.actioner.last_name}` })}
                  </div>
                </div>
              )}
              {config.resolveStatus && selected.status === config.resolveStatus && selected.resolved_at && (
                <div style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                    ✓ {statusMeta(config.resolveStatus).label} · {fmt(selected.resolved_at)}
                    {selected.resolver && t('by', { name: `${selected.resolver.first_name} ${selected.resolver.last_name}` })}
                  </div>
                </div>
              )}

              {/* Inline collect prompt */}
              {collectingStatus && (
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 12 }}>
                  <label className="form-label">{config.promptOnStatus.label}</label>
                  <input className="form-input" value={collectValue} onChange={e => setCollectValue(e.target.value)}
                    placeholder={t('enter_name')} autoFocus />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setCollectingStatus(null)} disabled={busy}>{t('cancel')}</button>
                    <button className="btn btn-success btn-sm" style={{ flex: 2 }} onClick={confirmCollect} disabled={busy}>{busy ? t('saving') : t('confirm')}</button>
                  </div>
                </div>
              )}

              {/* Status action buttons */}
              {!collectingStatus && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {config.statuses.filter(s => s.value !== selected.status).map(s => {
                    const isResolve = config.resolveStatus === s.value
                    return (
                      <button key={s.value} className={`btn ${isResolve ? 'btn-success' : ''}`} disabled={busy}
                        onClick={() => handleStatusClick(s.value)}
                        style={isResolve ? {} : { background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
                        {busy ? t('updating') : t('mark', { status: s.label })}
                      </button>
                    )
                  })}
                  <button className="btn btn-outline" onClick={() => setSelected(null)}>{t('close')}</button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── Add-record form (config-driven) ─────────────────────────────────
function AddRecordForm({ config, scopedSiteId, staffId, onClose, onSaved }) {
  const t = useT(TEXT)
  const sevOptions = config.severityOptions || SEVERITY_OPTIONS
  const initial = {}
  config.fields.forEach(f => {
    if (f.type === 'severity') initial[f.name] = 'medium'
    else if (f.type === 'datetime' && f.defaultNow) initial[f.name] = nowLocalInput()
    else initial[f.name] = ''
  })
  const [form, setForm]     = useState(initial)
  const [images, setImages] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const fileRef = useRef()

  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }))

  const addImages = (e) => {
    const files = Array.from(e.target.files)
    setImages(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f) }))])
  }
  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  // Phone cameras hand us all sorts of filenames (and sometimes none at all),
  // so derive a safe extension from the file type rather than trusting the name.
  const safeExt = (file) => {
    const fromName = (file.name || '').split('.').pop()
    if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) return fromName.toLowerCase()
    const fromType = (file.type || '').split('/').pop()
    if (fromType && /^[a-z0-9]{2,5}$/i.test(fromType)) return fromType.toLowerCase()
    return 'jpg'
  }

  const uploadImage = async (file, recordId, index) => {
    const path = `${config.recordType}/${recordId}/${Date.now()}-${index}.${safeExt(file)}`
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
    if (error) throw error
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    // required-field validation
    for (const f of config.fields) {
      if (f.required && !String(form[f.name] || '').trim()) {
        setError(t('fill_in', { field: f.label })); return
      }
    }
    setSaving(true); setError(null)

    // Step 1 — save the record itself. If this fails, nothing is logged.
    let rec
    try {
      const payload = { site_id: scopedSiteId, logged_by: staffId }
      config.fields.forEach(f => {
        let v = form[f.name]
        if (f.type === 'datetime') v = toISO(v)
        else if (typeof v === 'string') v = v.trim() || null
        payload[f.name] = v
      })
      const { data, error: insErr } = await supabase
        .from(config.table).insert(payload).select().single()
      if (insErr) throw insErr
      rec = data
    } catch (err) {
      console.error(`${config.table} insert failed:`, err)
      setError(err?.message ? t('save_failed', { msg: err.message }) : t('generic_error'))
      setSaving(false)
      return
    }

    // Step 2 — photos. The record is already safely logged, so a photo
    // problem must never throw the whole entry away; we report it instead.
    let photoWarning = null
    if (config.hasImages && images.length > 0) {
      let failed = 0
      let lastMsg = ''
      for (let i = 0; i < images.length; i++) {
        try {
          const url = await uploadImage(images[i].file, rec.id, i)
          const { error: imgErr } = await supabase.from('record_images').insert({
            record_type: config.recordType, record_id: rec.id, image_url: url,
          })
          if (imgErr) throw imgErr
        } catch (err) {
          console.error('photo upload failed:', err)
          failed++
          lastMsg = err?.message || ''
        }
      }
      if (failed > 0) {
        photoWarning = t('photo_warning', { item: config.singular, n: failed })
          + (lastMsg ? ` — ${lastMsg}` : '')
      }
    }

    setSaving(false)
    onSaved(photoWarning)
  }

  const renderField = (f) => {
    if (f.type === 'severity') {
      return (
        <select className="form-input" value={form[f.name]} onChange={e => setField(f.name, e.target.value)}>
          {sevOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    if (f.type === 'select') {
      return (
        <select className="form-input" value={form[f.name]} onChange={e => setField(f.name, e.target.value)}>
          <option value="">{t('select')}</option>
          {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    if (f.type === 'datetime') {
      return <input type="date" className="form-input" value={form[f.name]} onChange={e => setField(f.name, e.target.value)} />
    }
    if (f.type === 'textarea') {
      return <textarea className="form-input" rows={3} placeholder={f.placeholder || ''} value={form[f.name]} onChange={e => setField(f.name, e.target.value)} />
    }
    return <input className="form-input" placeholder={f.placeholder || ''} value={form[f.name]} onChange={e => setField(f.name, e.target.value)} />
  }

  // group consecutive "half" fields into rows of two
  const rows = []
  for (let i = 0; i < config.fields.length; i++) {
    const f = config.fields[i]
    const next = config.fields[i + 1]
    if (f.half && next && next.half) { rows.push([f, next]); i++ }
    else rows.push([f])
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{config.icon} {t('add_title', { item: config.singular })}</div>
          <button onClick={onClose} aria-label={t('close')} disabled={saving} style={{
            background: 'var(--off-white)', border: 'none', borderRadius: '50%', width: 30, height: 30,
            fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {rows.map((row, ri) => (
          <div key={ri} style={row.length === 2 ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } : {}}>
            {row.map(f => (
              <div className="form-group" key={f.name}>
                <label className="form-label">
                  {f.label}{f.required && <span style={{ color: 'var(--danger)' }}> *</span>}
                </label>
                {renderField(f)}
              </div>
            ))}
          </div>
        ))}

        {config.hasImages && (
          <div className="form-group">
            <label className="form-label">{t('photos_optional')}</label>
            <input type="file" accept="image/*" multiple capture="environment" ref={fileRef} style={{ display: 'none' }} onChange={addImages} />
            <div className="image-upload-area" onClick={() => fileRef.current?.click()}>📷 {t('photo_tap')}</div>
            {images.length > 0 && (
              <div className="image-preview-grid" style={{ marginTop: 10 }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img.url} className="image-preview" alt="" />
                    <button onClick={() => removeImage(i)} style={{
                      position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} style={{ flex: 1 }} disabled={saving}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
            {saving ? t('saving') : t('log_btn', { item: config.singular })}
          </button>
        </div>
      </div>
    </div>
  )
}
