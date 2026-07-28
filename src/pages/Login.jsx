import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { VALID_PIN_LENGTHS } from '../lib/permissions'

export default function Login() {
  const { loginWithPin, verifyManagerPin } = useAuth()
  const [step, setStep] = useState('site')
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [sitesLoading, setSitesLoading] = useState(true)
  const lastAttemptRef = useRef('')

  // Location gate state
  const [locating, setLocating]         = useState(false)
  const [blocked, setBlocked]           = useState(null)   // { pin, distance?, denied?, noGeo? }
  const [overrideMode, setOverrideMode] = useState(false)
  const [overridePin, setOverridePin]   = useState('')
  const [overrideError, setOverrideError] = useState('')

  useEffect(() => {
    supabase.from('sites').select('*').eq('active', true).order('name').then(({ data }) => {
      setSites(data || [])
      setSitesLoading(false)
    })
  }, [])

  const resetPinState = () => {
    setPin(''); setError(''); setBlocked(null)
    setOverrideMode(false); setOverridePin(''); setOverrideError('')
    lastAttemptRef.current = ''
  }

  const handleSiteSelect = (site) => {
    setSelectedSite(site)
    setStep('pin')
    resetPinState()
  }

  // Validate a PIN. May come back needing location, or off-site.
  const attemptLogin = async (candidate, opts = {}) => {
    if (loading) return
    if (!opts.coords && !opts.override && candidate === lastAttemptRef.current) return
    lastAttemptRef.current = candidate

    setLoading(true)
    const result = await loginWithPin(candidate, selectedSite.id, opts)
    setLoading(false)

    if (result.success) return

    if (result.needsLocation) { requestLocation(candidate); return }
    if (result.offSite)       { setBlocked({ pin: candidate, distance: result.distance }); setPin(''); return }

    // Wrong PIN
    if (candidate.length >= 8) {
      setShake(true)
      setTimeout(() => { setShake(false); setPin(''); lastAttemptRef.current = '' }, 600)
      setError('Incorrect PIN — try again')
    }
  }

  // Ask the browser for location, then re-attempt with coords.
  const requestLocation = (candidate) => {
    if (!navigator.geolocation) { setBlocked({ pin: candidate, noGeo: true }); setPin(''); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        attemptLogin(candidate, { coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } })
      },
      (err) => {
        setLocating(false)
        setBlocked({ pin: candidate, denied: err.code === 1 })
        setPin('')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  // Manager authorises an off-site login by entering their own PIN.
  const submitOverride = async (mgrPin) => {
    setLoading(true)
    const ok = await verifyManagerPin(mgrPin, selectedSite.id)
    if (!ok) { setLoading(false); setOverrideError('Not a manager PIN'); setOverridePin(''); return }
    lastAttemptRef.current = ''
    const result = await loginWithPin(blocked.pin, selectedSite.id, { override: true })
    setLoading(false)
    if (!result.success) { setOverrideError('Login failed — try again'); setOverridePin('') }
    // success → AuthProvider sets staff and the app switches view
  }

  const handleDigit = async (digit) => {
    if (loading) return
    if (overrideMode) {
      if (overridePin.length >= 8) return
      setOverrideError('')
      const next = overridePin + digit
      setOverridePin(next)
      if (next.length === 6 || next.length === 8) await submitOverride(next)
      return
    }
    if (blocked || locating) return
    if (pin.length >= 8) return
    setError('')
    const next = pin + digit
    setPin(next)
    if (VALID_PIN_LENGTHS.includes(next.length)) await attemptLogin(next)
  }

  const handleBack = () => {
    if (loading) return
    if (overrideMode) { setOverrideError(''); setOverridePin(p => p.slice(0, -1)); return }
    setError(''); setPin(p => p.slice(0, -1)); lastAttemptRef.current = ''
  }

  const handleClear = () => {
    if (loading) return
    if (overrideMode) { setOverrideError(''); setOverridePin(''); return }
    setError(''); setPin(''); lastAttemptRef.current = ''
  }

  const handleEnter = async () => {
    if (loading) return
    if (overrideMode) {
      if (overridePin.length === 6 || overridePin.length === 8) await submitOverride(overridePin)
      else setOverrideError('Manager PIN is 6 or 8 digits')
      return
    }
    if (pin.length === 0) return
    if (!VALID_PIN_LENGTHS.includes(pin.length)) {
      setError(`PIN must be ${VALID_PIN_LENGTHS.join(', ')} digits`); return
    }
    lastAttemptRef.current = ''
    await attemptLogin(pin)
  }

  // Physical keyboard support on the PIN screen.
  useEffect(() => {
    if (step !== 'pin') return
    const handleKeyDown = (e) => {
      if (loading) return
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handleDigit(e.key); return }
      if (e.key === 'Backspace')  { e.preventDefault(); handleBack(); return }
      if (e.key === 'Escape')     { e.preventDefault(); handleClear(); return }
      if (e.key === 'Enter')      { e.preventDefault(); handleEnter(); return }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pin, overridePin, overrideMode, blocked, locating, loading])

  const buttons = ['1','2','3','4','5','6','7','8','9','C','0','⌫']

  const activePin = overrideMode ? overridePin : pin
  const dotCount = overrideMode
    ? (overridePin.length > 6 ? 8 : 6)
    : (pin.length > 6 ? 8 : pin.length > 4 ? 6 : 4)

  const blockedMessage = () => {
    if (!blocked) return ''
    if (blocked.denied) return 'Location is off. Turn on location for this site and try again — you need to be at the gym to log in.'
    if (blocked.noGeo)  return "This device can't share its location, so we can't confirm you're at the gym."
    if (blocked.distance != null) return `You appear to be about ${blocked.distance}m away. You need to be at the gym to log in.`
    return "We couldn't confirm you're at the gym."
  }

  return (
    <div style={{
      height: '100%', background: 'var(--navy)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', gap: '36px', position: 'relative'
    }}>

      {/* Brand */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--aqua)', letterSpacing: '2px' }}>
          GYMPODS
        </div>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(127,192,195,0.5)', letterSpacing: '2px', marginTop: '6px' }}>
          POD Operational Resource
        </div>
        <div style={{ fontSize: '16px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: '6px', marginTop: '2px' }}>
          PODOR
        </div>
      </div>

      {/* Step 1 — Site selection */}
      {step === 'site' && (
        <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: '500', marginBottom: 4 }}>
            Select your site
          </div>
          {sitesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
          ) : (
            sites.map(site => (
              <button key={site.id} onClick={() => handleSiteSelect(site)} style={{
                padding: '18px 20px', borderRadius: '14px',
                background: 'rgba(127,192,195,0.12)',
                border: '1.5px solid rgba(127,192,195,0.2)',
                color: 'var(--white)', fontSize: '17px', fontWeight: '700',
                fontFamily: 'var(--font)', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{site.name}</span>
                <span style={{ color: 'var(--aqua)', fontSize: '20px' }}>›</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Step 2 — PIN entry */}
      {step === 'pin' && (
        <>
          <button onClick={() => { setStep('site'); resetPinState() }} style={{
            position: 'absolute', top: '24px', left: '24px',
            color: 'var(--aqua)', fontSize: '13px', fontWeight: '600',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
            ‹ {selectedSite?.name}
          </button>

          {locating ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className="spinner" />
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Checking you're at the gym…</div>
            </div>
          ) : blocked && !overrideMode ? (
            <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>📍</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#FF8080' }}>Can't log in here</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{blockedMessage()}</div>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <button onClick={() => { const p = blocked.pin; setBlocked(null); requestLocation(p) }} style={{
                  padding: '13px', borderRadius: 12, background: 'var(--aqua)', color: 'var(--navy)',
                  border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>Try again</button>
                <button onClick={() => { setOverrideMode(true); setOverridePin(''); setOverrideError('') }} style={{
                  padding: '13px', borderRadius: 12, background: 'rgba(127,192,195,0.12)', color: 'var(--white)',
                  border: '1.5px solid rgba(127,192,195,0.25)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>Manager override</button>
                <button onClick={resetPinState} style={{
                  padding: '10px', background: 'none', color: 'rgba(255,255,255,0.4)',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Start over</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: overrideMode ? 'var(--aqua)' : 'rgba(255,255,255,0.4)', fontWeight: overrideMode ? 700 : 500, textAlign: 'center' }}>
                  {overrideMode ? 'Manager override — enter a manager PIN to allow this login' : 'Enter your PIN'}
                </div>
                <div style={{ display: 'flex', gap: '12px', animation: shake ? 'shake 0.5s ease' : 'none' }}>
                  {Array.from({ length: dotCount }).map((_, i) => (
                    <div key={i} style={{
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: i < activePin.length ? 'var(--aqua)' : 'rgba(255,255,255,0.15)',
                      transition: 'background 0.15s',
                      transform: i < activePin.length ? 'scale(1.1)' : 'scale(1)'
                    }} />
                  ))}
                </div>
                {(error || overrideError) && <div style={{ fontSize: '13px', color: '#FF8080', fontWeight: '500' }}>{overrideMode ? overrideError : error}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%', maxWidth: '280px' }}>
                {buttons.map(btn => (
                  <button key={btn}
                    onClick={() => { if (btn === '⌫') handleBack(); else if (btn === 'C') handleClear(); else handleDigit(btn) }}
                    disabled={loading || (btn !== '⌫' && btn !== 'C' && activePin.length >= 8)}
                    style={{
                      height: '64px', borderRadius: '14px',
                      fontSize: btn === '⌫' ? '20px' : '24px',
                      fontWeight: '700', fontFamily: 'var(--font)',
                      border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      background: btn === 'C' ? 'rgba(217,79,79,0.2)' : btn === '⌫' ? 'rgba(255,255,255,0.08)' : 'rgba(127,192,195,0.12)',
                      color: btn === 'C' ? '#FF8080' : btn === '⌫' ? 'rgba(255,255,255,0.5)' : 'var(--white)',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    {loading && btn === '0' ? '···' : btn}
                  </button>
                ))}
              </div>

              {activePin.length > 0 && (
                <button
                  onClick={handleEnter}
                  disabled={loading}
                  style={{
                    width: '100%', maxWidth: '280px',
                    padding: '14px', borderRadius: '14px',
                    background: (overrideMode ? [6,8].includes(overridePin.length) : VALID_PIN_LENGTHS.includes(pin.length)) ? 'var(--aqua)' : 'rgba(127,192,195,0.2)',
                    color: (overrideMode ? [6,8].includes(overridePin.length) : VALID_PIN_LENGTHS.includes(pin.length)) ? 'var(--navy)' : 'rgba(255,255,255,0.4)',
                    border: 'none',
                    fontSize: '15px', fontWeight: '700',
                    fontFamily: 'var(--font)',
                    cursor: !loading ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? '···' : overrideMode ? 'Authorise' : 'Enter'}
                </button>
              )}

              {overrideMode && (
                <button onClick={() => { setOverrideMode(false); setOverridePin(''); setOverrideError('') }} style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>‹ Back</button>
              )}
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
      `}</style>
    </div>
  )
}
