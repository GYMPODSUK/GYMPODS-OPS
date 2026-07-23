// src/lib/registers.js
// Configuration for the "Logs" registers (Phase 2).
// Each register is a purpose-built Supabase table, but they all render
// through one shared component (src/pages/registers/Register.jsx).
// To add a new register later (e.g. Visitor book, PT enquiry), add its
// table via SQL and add one entry here — no new page required.

// Field types supported by the shared form renderer:
//   'text'      — single-line input
//   'textarea'  — multi-line input
//   'select'    — dropdown (needs options: [{ value, label }])
//   'datetime'  — date + time picker (stored as ISO timestamp)
// Field flags:
//   required    — must be filled before save
//   half        — render two fields side-by-side in a row
//   listMeta    — show this value in the row subtitle in the list view

export const SEVERITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: 'var(--success)', bg: 'var(--success-bg)' },
  { value: 'medium', label: 'Medium', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  { value: 'high',   label: 'High',   color: 'var(--danger)',  bg: 'var(--danger-bg)'  },
]

export const REGISTERS = {
  complaints: {
    key:        'complaints',
    table:      'complaints',
    recordType: 'complaint',
    label:      'Complaints',
    singular:   'Complaint',
    icon:       '📣',
    blurb:      'Log member/visitor complaints and track them to resolution.',
    hasImages:  true,
    hasSeverity: true,               // shows Low/Medium/High + escalation highlight
    rowPrimary: 'description',        // used as the row title
    // Status lifecycle. First entry is the default on creation.
    statuses: [
      { value: 'open',        label: 'Open',        color: 'var(--danger)',  bg: 'var(--danger-bg)'  },
      { value: 'in_progress', label: 'In Progress', color: 'var(--warning)', bg: 'var(--warning-bg)' },
      { value: 'resolved',    label: 'Resolved',    color: 'var(--success)', bg: 'var(--success-bg)' },
    ],
    resolveStatus: 'resolved',        // moving here stamps resolved_by / resolved_at
    fields: [
      { name: 'complainant_name',    label: 'Complainant name',    type: 'text',     half: true,  placeholder: 'e.g. J. Smith' },
      { name: 'complainant_contact', label: 'Contact (phone/email)', type: 'text',   half: true,  placeholder: 'Optional' },
      { name: 'category',            label: 'Category',            type: 'select',   half: true,  options: [
        { value: 'cleanliness', label: 'Cleanliness' },
        { value: 'staff',       label: 'Staff / service' },
        { value: 'equipment',   label: 'Equipment' },
        { value: 'facilities',  label: 'Facilities' },
        { value: 'billing',     label: 'Billing / membership' },
        { value: 'other',       label: 'Other' },
      ] },
      { name: 'severity',            label: 'Severity',            type: 'severity', half: true },
      { name: 'description',         label: 'What happened',       type: 'textarea', required: true, placeholder: 'Describe the complaint…' },
    ],
  },

  lost_found: {
    key:        'lost_found',
    table:      'lost_found',
    recordType: 'lost_found',
    label:      'Lost & Found',
    singular:   'Item',
    icon:       '🎒',
    blurb:      'Register found property with a photo; mark it when collected.',
    hasImages:  true,
    hasSeverity: false,
    rowPrimary: 'item_description',
    statuses: [
      { value: 'unclaimed', label: 'Unclaimed', color: 'var(--warning)', bg: 'var(--warning-bg)' },
      { value: 'claimed',   label: 'Collected', color: 'var(--success)', bg: 'var(--success-bg)' },
      { value: 'disposed',  label: 'Disposed',  color: 'var(--text-light)', bg: 'var(--off-white)' },
    ],
    // When moving to 'claimed', prompt for who collected it and stamp the time.
    promptOnStatus: {
      status: 'claimed',
      field:  'collected_by_name',
      label:  'Collected by (name)',
      timestampField: 'collected_at',
    },
    fields: [
      { name: 'item_description', label: 'Item description', type: 'text',     required: true, placeholder: 'e.g. Black AirPods case' },
      { name: 'found_location',   label: 'Where found',      type: 'text',     half: true, placeholder: 'e.g. Studio 2' },
      { name: 'comments',         label: 'Comments',         type: 'textarea', placeholder: 'Any extra detail…' },
    ],
  },

  incidents: {
    key:        'incidents',
    table:      'incidents',
    recordType: 'incident',
    label:      'Incidents',
    singular:   'Incident',
    icon:       '⚠️',
    blurb:      'Record incidents, injuries and near-misses with full detail.',
    hasImages:  true,
    hasSeverity: true,
    rowPrimary: 'description',
    statuses: [
      { value: 'open',        label: 'Open',        color: 'var(--danger)',  bg: 'var(--danger-bg)'  },
      { value: 'in_progress', label: 'Reviewing',   color: 'var(--warning)', bg: 'var(--warning-bg)' },
      { value: 'resolved',    label: 'Closed',      color: 'var(--success)', bg: 'var(--success-bg)' },
    ],
    resolveStatus: 'resolved',
    fields: [
      { name: 'incident_at',      label: 'When it happened', type: 'datetime', half: true, defaultNow: true },
      { name: 'category',         label: 'Type',             type: 'select',   half: true, options: [
        { value: 'injury',    label: 'Injury' },
        { value: 'near_miss', label: 'Near-miss' },
        { value: 'security',  label: 'Security' },
        { value: 'equipment', label: 'Equipment failure' },
        { value: 'property',  label: 'Property / damage' },
        { value: 'other',     label: 'Other' },
      ] },
      { name: 'severity',         label: 'Severity',         type: 'severity', half: true },
      { name: 'persons_involved', label: 'Who was involved', type: 'text',     half: true, placeholder: 'Names / roles' },
      { name: 'description',      label: 'What happened',    type: 'textarea', required: true, placeholder: 'Full detail of the incident…' },
      { name: 'action_taken',     label: 'Action taken',     type: 'textarea', placeholder: 'What was done at the time…' },
    ],
  },
}

// Order the registers appear in the hub.
export const REGISTER_ORDER = ['complaints', 'lost_found', 'incidents']
