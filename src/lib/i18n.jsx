// src/lib/i18n.jsx
// PODOR languages — the engine. No external library.
//
// How it works
// • Each screen keeps its OWN translations at the top of its file, e.g.
//     const TEXT = {
//       en: { title: 'Choose your shift' },
//       fr: { title: 'Choisissez votre service' },
//       ...
//     }
//   and reads them with   const t = useT(TEXT)   →   t('title')
//   So adding languages to a screen never means re-pasting a giant shared file.
// • Missing translation → falls back to English → falls back to the key.
// • Placeholders: t('hello', { name: 'Sam' }) fills "{name}" in the string.
//
// Where the language comes from
// • Before login: the choice last made on THIS device (login screen picker).
// • At login: the staff member's saved language (staff.language) takes over,
//   so it follows them to any tablet at any gym.
// • Changing it while logged in saves to their staff row AND this device.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'

export const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', name: 'English',   short: 'EN', locale: 'en-GB' },
  { code: 'fr', flag: '🇫🇷', name: 'Français',  short: 'FR', locale: 'fr-FR' },
  { code: 'es', flag: '🇪🇸', name: 'Español',   short: 'ES', locale: 'es-ES' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano',  short: 'IT', locale: 'it-IT' },
  { code: 'pt', flag: '🇵🇹', name: 'Português', short: 'PT', locale: 'pt-PT' },
]
const CODES = LANGUAGES.map(l => l.code)
const DEVICE_KEY  = 'podor_language'   // this device's last choice
const SESSION_KEY = 'gympods_staff'    // AuthContext's saved session

const valid = (code) => (CODES.includes(code) ? code : null)
const readDevice = () => {
  try { return valid(localStorage.getItem(DEVICE_KEY)) } catch { return null }
}
const writeDevice = (code) => {
  try { localStorage.setItem(DEVICE_KEY, code) } catch { /* private mode etc. */ }
}

const LanguageContext = createContext({
  lang: 'en', locale: 'en-GB', setLanguage: () => {},
})

export function LanguageProvider({ children }) {
  const { staff } = useAuth()
  const [lang, setLang] = useState(() => readDevice() || 'en')
  const appliedFor = useRef(null)   // which staff id we've already applied a language for

  // When someone logs in (staff id changes), switch to their saved language.
  useEffect(() => {
    if (!staff?.id) { appliedFor.current = null; return }
    if (appliedFor.current === staff.id) return
    appliedFor.current = staff.id
    const saved = valid(staff.language)
    if (saved) { setLang(saved); writeDevice(saved) }
  }, [staff?.id, staff?.language])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const setLanguage = async (code) => {
    if (!valid(code)) return
    setLang(code)
    writeDevice(code)
    if (!staff?.id) return
    // Keep the saved session in step, so a page refresh doesn't revert it.
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
      if (saved && saved.id === staff.id) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...saved, language: code }))
      }
    } catch { /* ignore */ }
    const { error } = await supabase.from('staff').update({ language: code }).eq('id', staff.id)
    if (error) console.error('saving language failed:', error)
  }

  const locale = LANGUAGES.find(l => l.code === lang)?.locale || 'en-GB'

  return (
    <LanguageContext.Provider value={{ lang, locale, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

/** { lang, locale, setLanguage } — locale is for dates, e.g. toLocaleDateString(locale, …) */
export const useLanguage = () => useContext(LanguageContext)

/** const t = useT(TEXT);  t('key')  or  t('key', { name: 'Sam' }) */
export function useT(dict) {
  const { lang } = useLanguage()
  return (key, vars) => {
    let s = dict?.[lang]?.[key] ?? dict?.en?.[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
    return s
  }
}

/**
 * Flag button ("🇵🇹 PT") that opens the language list.
 * tone="dark"  → for navy backgrounds (header, login)   [default]
 * tone="light" → for white/grey backgrounds
 */
export function LanguagePicker({ tone = 'dark' }) {
  const { lang, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  const pick = (code) => { setLanguage(code); setOpen(false) }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Language" style={{
        display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
        padding: '5px 9px', borderRadius: 20, fontSize: 12, fontWeight: 800,
        fontFamily: 'var(--font)', lineHeight: 1,
        background: tone === 'dark' ? 'rgba(255,255,255,0.1)' : 'var(--off-white)',
        color: tone === 'dark' ? 'var(--white)' : 'var(--navy)',
        border: `1px solid ${tone === 'dark' ? 'rgba(255,255,255,0.18)' : 'var(--border)'}`,
      }}>
        {/* Globe, not flag: Windows can't draw flag emojis (it shows "FR FR"). */}
        <span style={{ fontSize: 14 }}>🌐</span>{current.short}
      </button>

      {open && (
        <div className="modal-overlay" style={{ alignItems: 'center', padding: 16, zIndex: 200 }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal-sheet" style={{ borderRadius: 'var(--radius-xl)', margin: 'auto', maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 12, textAlign: 'center' }}>
              🌐 Language · Langue · Idioma · Lingua · Idioma
            </div>
            {LANGUAGES.map(l => {
              const active = l.code === lang
              return (
                <button key={l.code} onClick={() => pick(l.code)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  padding: '12px 14px', marginBottom: 8, borderRadius: 'var(--radius-md)',
                  fontSize: 16, fontWeight: 700, textAlign: 'left', fontFamily: 'var(--font)',
                  background: active ? 'var(--aqua-light)' : 'var(--white)',
                  color: 'var(--navy)',
                  border: `1px solid ${active ? 'var(--aqua)' : 'var(--border)'}`,
                }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{l.flag}</span>
                  <span style={{ flex: 1 }}>{l.name}</span>
                  {active && <span style={{ color: 'var(--aqua-dark)', fontSize: 18 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
