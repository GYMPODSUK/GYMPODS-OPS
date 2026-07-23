// src/lib/registers.js
// Configuration for the "Forms & Registers" area (Phase 2).
// Each entry is a purpose-built Supabase table, but they all render
// through one shared component (src/pages/registers/Register.jsx) and
// appear in one dropdown grouped by `group`.
// To add a new form later: add its table via SQL + add one entry here.

// Field types supported by the shared form renderer:
//   'text' | 'textarea' | 'select' | 'datetime' | 'severity'
// Field flags: required, half (two side-by-side), options (for select).

export const SEVERITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: 'var(--success)', bg: 'var(--success-bg)' },
  { value: 'medium', label: 'Medium', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  { value: 'high',   label: 'High',   color: 'var(--danger)',  bg: 'var(--danger-bg)'  },
]

// Shared lifecycle for the enquiry/lead forms.
const ENQUIRY_STATUSES = [
  { value: 'new',       label: 'New',       color: 'var(--warning)',   bg: 'var(--warning-bg)' },
  { value: 'contacted', label: 'Contacted', color: 'var(--aqua-dark)', bg: 'var(--aqua-light)' },
  { value: 'closed',    label: 'Closed',    color: 'var(--success)',   bg: 'var(--success-bg)' },
]

export const REGISTERS = {
  // ── REGISTERS ──────────────────────────────────────────────────
  complaints: {
    key: 'complaints', table: 'complaints', recordType: 'complaint', group: 'Registers',
    label: 'Complaints', singular: 'Complaint', icon: '📣',
    blurb: 'Log member/visitor complaints and track them to resolution.',
    hasImages: true, hasSeverity: true, rowPrimary: 'description',
    statuses: [
      { value: 'open',        label: 'Open',        color: 'var(--danger)',  bg: 'var(--danger-bg)'  },
      { value: 'in_progress', label: 'In Progress', color: 'var(--warning)', bg: 'var(--warning-bg)' },
      { value: 'resolved',    label: 'Resolved',    color: 'var(--success)', bg: 'var(--success-bg)' },
    ],
    resolveStatus: 'resolved',
    fields: [
      { name: 'complainant_name',    label: 'Complainant name',      type: 'text',     half: true, placeholder: 'e.g. J. Smith' },
      { name: 'complainant_contact', label: 'Contact (phone/email)', type: 'text',     half: true, placeholder: 'Optional' },
      { name: 'category',            label: 'Category',              type: 'select',   half: true, options: [
        { value: 'cleanliness', label: 'Cleanliness' },
        { value: 'staff',       label: 'Staff / service' },
        { value: 'equipment',   label: 'Equipment' },
        { value: 'facilities',  label: 'Facilities' },
        { value: 'billing',     label: 'Billing / membership' },
        { value: 'other',       label: 'Other' },
      ] },
      { name: 'severity',            label: 'Severity',              type: 'severity', half: true },
      { name: 'description',         label: 'What happened',         type: 'textarea', required: true, placeholder: 'Describe the complaint…' },
    ],
  },

  lost_found: {
    key: 'lost_found', table: 'lost_found', recordType: 'lost_found', group: 'Registers',
    label: 'Lost & Found', singular: 'Item', icon: '🎒',
    blurb: 'Register found property with a photo; mark it when collected.',
    hasImages: true, hasSeverity: false, rowPrimary: 'item_description',
    statuses: [
      { value: 'unclaimed', label: 'Unclaimed', color: 'var(--warning)',    bg: 'var(--warning-bg)' },
      { value: 'claimed',   label: 'Collected', color: 'var(--success)',    bg: 'var(--success-bg)' },
      { value: 'disposed',  label: 'Disposed',  color: 'var(--text-light)', bg: 'var(--off-white)' },
    ],
    promptOnStatus: { status: 'claimed', field: 'collected_by_name', label: 'Collected by (name)', timestampField: 'collected_at' },
    fields: [
      { name: 'item_description', label: 'Item description', type: 'text',     required: true, placeholder: 'e.g. Black AirPods case' },
      { name: 'found_location',   label: 'Where found',      type: 'text',     half: true, placeholder: 'e.g. Studio 2' },
      { name: 'comments',         label: 'Comments',         type: 'textarea', placeholder: 'Any extra detail…' },
    ],
  },

  incidents: {
    key: 'incidents', table: 'incidents', recordType: 'incident', group: 'Registers',
    label: 'Incidents', singular: 'Incident', icon: '⚠️',
    blurb: 'Record incidents, injuries and near-misses with full detail.',
    hasImages: true, hasSeverity: true, rowPrimary: 'description',
    statuses: [
      { value: 'open',        label: 'Open',      color: 'var(--danger)',  bg: 'var(--danger-bg)'  },
      { value: 'in_progress', label: 'Reviewing', color: 'var(--warning)', bg: 'var(--warning-bg)' },
      { value: 'resolved',    label: 'Closed',    color: 'var(--success)', bg: 'var(--success-bg)' },
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

  visitors: {
    key: 'visitors', table: 'visitors', recordType: 'visitor', group: 'Registers',
    label: 'Visitor Book', singular: 'Visitor', icon: '📖',
    blurb: 'Sign visitors in, then sign them out when they leave.',
    hasImages: false, hasSeverity: false, rowPrimary: 'visitor_name',
    showTimes: true, // sign-in / sign-out show the time of day (this is the point of a visitor book)
    statuses: [
      { value: 'on_site',    label: 'On site',    color: 'var(--warning)', bg: 'var(--warning-bg)' },
      { value: 'signed_out', label: 'Signed out', color: 'var(--success)', bg: 'var(--success-bg)' },
    ],
    resolveStatus: 'signed_out', // sign-out stamps resolved_by/resolved_at (= time out)
    fields: [
      { name: 'visitor_name', label: 'Visitor name',         type: 'text',     required: true, placeholder: 'Full name' },
      { name: 'company',      label: 'Company / organisation', type: 'text',   half: true, placeholder: 'Optional' },
      { name: 'purpose',      label: 'Purpose of visit',     type: 'text',     half: true, placeholder: 'e.g. Contractor' },
      { name: 'comments',     label: 'Notes',                type: 'textarea', placeholder: 'Anything to note…' },
    ],
  },

  // ── ENQUIRIES ──────────────────────────────────────────────────
  pt_enquiry: {
    key: 'pt_enquiry', table: 'pt_enquiries', recordType: 'pt_enquiry', group: 'Enquiries',
    label: 'PT Enquiry', singular: 'PT Enquiry', icon: '🏋️',
    blurb: 'A personal trainer enquiring to work with GYMPODS.',
    hasImages: false, hasSeverity: false, rowPrimary: 'contact_name',
    statuses: ENQUIRY_STATUSES, resolveStatus: 'closed',
    fields: [
      { name: 'contact_name', label: 'PT name',       type: 'text',     required: true, placeholder: 'Full name' },
      { name: 'email',        label: 'Email',         type: 'text',     half: true, placeholder: 'name@email.com' },
      { name: 'phone',        label: 'Mobile number', type: 'text',     half: true, placeholder: '07…' },
      { name: 'preferred_at', label: 'Preferred date',type: 'datetime', half: true },
      { name: 'comments',     label: 'Comments',      type: 'textarea', placeholder: 'What are they enquiring about…' },
    ],
  },

  pt_client_request: {
    key: 'pt_client_request', table: 'pt_client_requests', recordType: 'pt_client_request', group: 'Enquiries',
    label: 'Client Wants a PT', singular: 'PT Request', icon: '💪',
    blurb: 'A client asking to be matched with a personal trainer.',
    hasImages: false, hasSeverity: false, rowPrimary: 'contact_name',
    statuses: ENQUIRY_STATUSES, resolveStatus: 'closed',
    fields: [
      { name: 'contact_name', label: 'Client name',    type: 'text',     required: true, placeholder: 'Full name' },
      { name: 'email',        label: 'Email',          type: 'text',     half: true, placeholder: 'name@email.com' },
      { name: 'preferred_at', label: 'Preferred date', type: 'datetime', half: true },
      { name: 'comments',     label: 'Comments',       type: 'textarea', placeholder: 'Goals / what they’re after…' },
    ],
  },

  tour_enquiry: {
    key: 'tour_enquiry', table: 'tour_enquiries', recordType: 'tour_enquiry', group: 'Enquiries',
    label: 'Client Tour', singular: 'Tour Enquiry', icon: '📅',
    blurb: 'A prospective member wanting a tour of the gym.',
    hasImages: false, hasSeverity: false, rowPrimary: 'contact_name',
    statuses: ENQUIRY_STATUSES, resolveStatus: 'closed',
    fields: [
      { name: 'contact_name', label: 'Name',               type: 'text',     required: true, placeholder: 'Full name' },
      { name: 'email',        label: 'Email',              type: 'text',     half: true, placeholder: 'name@email.com' },
      { name: 'preferred_at', label: 'Preferred tour date',type: 'datetime', half: true },
      { name: 'comments',     label: 'Comments',           type: 'textarea', placeholder: 'Anything they mentioned…' },
    ],
  },
}

// Order + grouping for the dropdown.
export const REGISTER_ORDER = [
  'complaints', 'lost_found', 'incidents', 'visitors',
  'pt_enquiry', 'pt_client_request', 'tour_enquiry',
]
