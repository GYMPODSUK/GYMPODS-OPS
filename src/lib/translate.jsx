// src/lib/translate.jsx
// Shows text that staff TYPED (messages, notes…) in the reader's language,
// using the Supabase "translate" Edge Function (DeepL behind it).
//
//   <TranslatedText text={note.body} authorLang={note.author?.language} />
//
// • Same language as the reader → shown as written, no request made.
// • Otherwise → shown translated, with "Translated from Português · Show original".
// • Requests are batched (many messages on screen = one request) and remembered
//   for this session; the server also remembers them permanently.
// • If translation fails for any reason, the original text is simply shown.
import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useLanguage, useT } from './i18n'

const TEXT = {
  en: { from: 'Translated from {lang}', show_original: 'Show original', show_translation: 'Show translation' },
  fr: { from: 'Traduction automatique ({lang})',      show_original: "Voir l'original", show_translation: 'Voir la traduction' },
  es: { from: 'Traducido del {lang}',   show_original: 'Ver original',   show_translation: 'Ver traducción' },
  it: { from: 'Traduzione automatica ({lang})',    show_original: "Mostra l'originale", show_translation: 'Mostra la traduzione' },
  pt: { from: 'Traduzido do {lang}',    show_original: 'Ver original',   show_translation: 'Ver tradução' },
}

// ── batching + session memory ─────────────────────────────────────
const memory = new Map()            // `${lang}|${text}` → Promise<{text, source}|null>
const queues = new Map()            // lang → [{ text, resolve }]
let timer = null

function flush() {
  timer = null
  for (const [lang, items] of queues) {
    queues.delete(lang)
    const texts = items.map(i => i.text)
    supabase.functions.invoke('translate', { body: { texts, target: lang } })
      .then(({ data, error }) => {
        if (error || !Array.isArray(data?.results)) {
          if (error) console.error('translate failed:', error)
          items.forEach(i => i.resolve(null))
          return
        }
        items.forEach((i, idx) => i.resolve(data.results[idx] || null))
      })
      .catch(err => { console.error('translate failed:', err); items.forEach(i => i.resolve(null)) })
  }
}

export function translateText(text, lang) {
  const key = `${lang}|${text}`
  if (memory.has(key)) return memory.get(key)
  const p = new Promise(resolve => {
    if (!queues.has(lang)) queues.set(lang, [])
    queues.get(lang).push({ text, resolve })
    if (!timer) timer = setTimeout(flush, 40)
  }).then(r => {
    if (!r) memory.delete(key)       // allow a retry later if it failed
    return r
  })
  memory.set(key, p)
  return p
}

// Language name in the reader's language, e.g. 'pt' → "portugais" for a French reader.
function languageName(code, locale) {
  try { return new Intl.DisplayNames([locale], { type: 'language' }).of(code) || code }
  catch { return code }
}

/**
 * props:
 *  text        the text as typed
 *  authorLang  the writer's language setting, if known (skips the request when it matches)
 *  compact     true = just the translated text + a small 🌐 (for list rows)
 *  style / className  applied to the text
 */
export function TranslatedText({ text, authorLang, compact = false, style, className }) {
  const { lang, locale } = useLanguage()
  const t = useT(TEXT)
  const [result, setResult]     = useState(null)
  const [original, setOriginal] = useState(false)

  const needed = !!text && !!text.trim() && authorLang !== lang

  useEffect(() => {
    setResult(null); setOriginal(false)
    if (!needed) return
    let alive = true
    translateText(text, lang).then(r => { if (alive) setResult(r) })
    return () => { alive = false }
  }, [text, lang, needed])

  // Only treat it as translated if DeepL says it came from another language
  // and the wording actually changed.
  const translated = needed && result && result.source && result.source !== lang && result.text && result.text !== text

  if (!translated) return <span className={className} style={style}>{text}</span>

  if (compact) {
    return (
      <span className={className} style={style} title={text}>
        <span aria-hidden="true" style={{ fontSize: '0.85em', marginRight: 4 }}>🌐</span>{result.text}
      </span>
    )
  }

  return (
    <>
      <span className={className} style={style}>{original ? text : result.text}</span>
      <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--text-light)', fontStyle: 'normal', fontWeight: 500 }}>
        🌐 {original ? languageName(result.source, locale) : t('from', { lang: languageName(result.source, locale) })}
        {' · '}
        <button type="button" onClick={(e) => { e.stopPropagation(); setOriginal(o => !o) }} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: 'var(--aqua-dark)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)',
        }}>
          {original ? t('show_translation') : t('show_original')}
        </button>
      </span>
    </>
  )
}
