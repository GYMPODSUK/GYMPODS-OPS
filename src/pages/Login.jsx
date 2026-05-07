import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { loginWithPin } = useAuth()
  const [step, setStep] = useState('site')
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [sitesLoading, setSitesLoading] = useState(true)

  useEffect(() => {
    supabase.from('sites').select('*').eq('active', true).order('name').then(({ data }) => {
      setSites(data || [])
      setSitesLoading(false)
    })
  }, [])

  const handleSiteSelect = (site) => {
    setSelectedSite(site)
    setStep('pin')
    setError('')
    setPin('')
  }

  const handleDigit = async (digit) => {
    if (loading) return
    setError('')
    const next = pin + digit
    setPin(next)
    if (next.length === 4) {
      setLoading(true)
      const result = await loginWithPin(next, selectedSite.id)
      setLoading(false)
      if (!result.success) {
        setShake(true)
        setTimeout(() => { setShake(false); setPin('') }, 600)
        setError('Incorrect PIN — try again')
      }
    }
  }

  const handleBack = () => { if (!loading) { setError(''); setPin(p => p.slice(0, -1)) } }
  const handleClear = () => { if (!loading) { setError(''); setPin('') } }
  const buttons = ['1','2','3','4','5','6','7','8','9','C','0','⌫']

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
        <div style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(127,192,195,0.5)', letterSpacing: '4px', marginTop: '4px' }}>
          OPS
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
          <button onClick={() => { setStep('site'); setPin(''); setError('') }} style={{
            position: 'absolute', top: '24px', left: '24px',
            color: 'var(--aqua)', fontSize: '13px', fontWeight: '600',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
            ‹ {selectedSite?.name}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>
              Enter your PIN
            </div>
            <div style={{ display: 'flex', gap: '16px', animation: shake ? 'shake 0.5s ease' : 'none' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: i < pin.length ? 'var(--aqua)' : 'rgba(255,255,255,0.15)',
                  transition: 'background 0.15s',
                  transform: i < pin.length ? 'scale(1.1)' : 'scale(1)'
                }} />
              ))}
            </div>
            {error && <div style={{ fontSize: '13px', color: '#FF8080', fontWeight: '500' }}>{error}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%', maxWidth: '280px' }}>
            {buttons.map(btn => (
              <button key={btn}
                onClick={() => { if (btn === '⌫') handleBack(); else if (btn === 'C') handleClear(); else handleDigit(btn) }}
                disabled={loading || (btn !== '⌫' && btn !== 'C' && pin.length >= 4)}
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
