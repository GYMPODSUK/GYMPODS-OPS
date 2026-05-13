import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES, fullName } from '../../lib/permissions'

export default function Sites() {
  const { staff } = useAuth()
  const isHQ = staff?.role === ROLES.HQ

  const [sites, setSites] = useState([])
  const [regions, setRegions] = useState([])
  const [adminStaff, setAdminStaff] = useState([])      // staff with role='admin' (Site Managers)
  const [regionMgrStaff, setRegionMgrStaff] = useState([]) // staff with role='region_manager'
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showRegions, setShowRegions] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [form, setForm] = useState({
    name: '', address: '', latitude: '', longitude: '',
    geofence_radius: '200', active: true,
    region_id: '', primary_admin_id: '',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [s, r, a, rm] = await Promise.all([
      supabase.from('sites').select('*, regions(name), primary_admin:primary_admin_id(first_name, last_name)').order('name'),
      supabase.from('regions').select('*, manager:manager_id(first_name, last_name)').order('name'),
      supabase.from('staff').select('id, first_name, last_name, site_id, active').eq('role', 'admin').eq('active', true),
      supabase.from('staff').select('id, first_name, last_name, region_id, active').eq('role', 'region_manager').eq('active', true),
    ])
    setSites(s.data || [])
    setRegions(r.data || [])
    setAdminStaff(a.data || [])
    setRegionMgrStaff(rm.data || [])
    setLoading(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      name: '', address: '', latitude: '', longitude: '',
      geofence_radius: '200', active: true,
      region_id: '', primary_admin_id: '',
    })
    setShowForm(true)
  }

  const openEdit = (site) => {
    setEditing(site)
    setForm({
      name: site.name,
      address: site.address || '',
      latitude: site.latitude || '',
      longitude: site.longitude || '',
      geofence_radius: site.geofence_radius || '200',
      active: site.active,
      region_id: site.region_id || '',
      primary_admin_id: site.primary_admin_id || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Site name required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        geofence_radius: form.geofence_radius ? parseInt(form.geofence_radius) : 200,
        active: form.active,
        region_id: form.region_id || null,
        primary_admin_id: form.primary_admin_id || null,
      }
      if (editing) {
        await supabase.from('sites').update(payload).eq('id', editing.id)
        showToast('Site updated')
      } else {
        await supabase.from('sites').insert(payload)
        showToast('Site added')
      }
      setShowForm(false)
      loadData()
    } catch (err) {
      showToast('Error saving', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (site) => {
    await supabase.from('sites').update({ active: !site.active }).eq('id', site.id)
    showToast(site.active ? 'Site deactivated' : 'Site activated')
    loadData()
  }

  const getMapLink = (site) => {
    if (site.latitude && site.longitude) {
      return `https://www.google.com/maps?q=${site.latitude},${site.longitude}`
    }
    if (site.address) {
      return `https://www.google.com/maps/search/${encodeURIComponent(site.address)}`
    }
    return null
  }

  // Site Managers eligible to be the main manager for the site being edited.
  // Show staff with role='admin' who are either already at this site, or unassigned.
  const eligibleSiteManagers = adminStaff.filter(a =>
    !editing || !a.site_id || a.site_id === editing.id
  )

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  // Group sites by region (matches Network Overview convention)
  const sitesByRegion = regions.map(r => ({
    ...r, sites: sites.filter(s => s.region_id === r.id),
  }))
  const unassigned = sites.filter(s => !s.region_id)

  return (
    <>
      <div style={{
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        flexShrink: 0, padding: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>Sites</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              HQ access only · {sites.length} {sites.length === 1 ? 'site' : 'sites'} across {regions.length} regions
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {isHQ && (
              <button
