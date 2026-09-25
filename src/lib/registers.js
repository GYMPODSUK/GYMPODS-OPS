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

// ════════════════════════════════════════════════════════════════════
// LANGUAGES — translated labels for the forms above.
// English lives in the config itself; these override it per language.
// Only wording changes — every `value` (what's saved in the database)
// stays the same in every language, so records, emails and reports are
// unaffected.
//   t: [label, singular, blurb]   s: statuses   f: { field: [label, placeholder] }
//   o: select options             prompt: the "collected by" style label
// ════════════════════════════════════════════════════════════════════
const FORM_LANG = {
  fr: {
    groups: { Registers: 'Registres', Enquiries: 'Demandes' },
    severity: { low: 'Faible', medium: 'Moyenne', high: 'Élevée' },
    enquiry: { new: 'Nouveau', contacted: 'Contacté', closed: 'Clôturé' },
    forms: {
      complaints: {
        t: ['Réclamations', 'Réclamation', "Enregistrez les réclamations des membres ou visiteurs et suivez-les jusqu'à leur résolution."],
        s: { open: 'Ouverte', in_progress: 'En cours', resolved: 'Résolue' },
        f: { complainant_name: ['Nom du plaignant', 'ex. J. Dupont'], complainant_contact: ['Contact (tél./e-mail)', 'Facultatif'],
             category: ['Catégorie'], severity: ['Gravité'], description: ["Ce qui s'est passé", 'Décrivez la réclamation…'] },
        o: { category: { cleanliness: 'Propreté', staff: 'Personnel / service', equipment: 'Équipement',
                         facilities: 'Installations', billing: 'Facturation / abonnement', other: 'Autre' } },
      },
      lost_found: {
        t: ['Objets trouvés', 'Objet', 'Enregistrez les objets trouvés avec une photo ; indiquez quand ils sont récupérés.'],
        s: { unclaimed: 'Non réclamé', claimed: 'Récupéré', disposed: 'Éliminé' },
        f: { item_description: ["Description de l'objet", 'ex. Étui AirPods noir'], found_location: ['Lieu de découverte', 'ex. Studio 2'],
             comments: ['Commentaires', 'Autres détails…'] },
        prompt: 'Récupéré par (nom)',
      },
      incidents: {
        t: ['Incidents', 'Incident', 'Consignez les incidents, blessures et quasi-accidents en détail.'],
        s: { open: 'Ouvert', in_progress: 'En examen', resolved: 'Clos' },
        f: { incident_at: ['Date des faits'], category: ['Type'], severity: ['Gravité'],
             persons_involved: ['Personnes impliquées', 'Noms / rôles'], description: ["Ce qui s'est passé", "Détail complet de l'incident…"],
             action_taken: ['Mesures prises', 'Ce qui a été fait sur le moment…'] },
        o: { category: { injury: 'Blessure', near_miss: 'Quasi-accident', security: 'Sécurité',
                         equipment: "Panne d'équipement", property: 'Biens / dégâts', other: 'Autre' } },
      },
      visitors: {
        t: ['Registre des visiteurs', 'Visiteur', "Enregistrez l'arrivée des visiteurs, puis leur départ."],
        s: { on_site: 'Sur place', signed_out: 'Parti' },
        f: { visitor_name: ['Nom du visiteur', 'Nom complet'], company: ['Société / organisation', 'Facultatif'],
             purpose: ['Motif de la visite', 'ex. Prestataire'], comments: ['Notes', 'À signaler…'] },
      },
      pt_enquiry: {
        t: ['Demande de coach', 'Demande de coach', 'Un coach personnel souhaitant travailler avec GYMPODS.'],
        f: { contact_name: ['Nom du coach', 'Nom complet'], email: ['E-mail'], phone: ['Portable'],
             preferred_at: ['Date souhaitée'], comments: ['Commentaires', 'Objet de sa demande…'] },
      },
      pt_client_request: {
        t: ['Client souhaitant un coach', 'Demande de coach', 'Un client souhaitant être mis en relation avec un coach personnel.'],
        f: { contact_name: ['Nom du client', 'Nom complet'], email: ['E-mail'], preferred_at: ['Date souhaitée'],
             comments: ['Commentaires', 'Objectifs / attentes…'] },
      },
      tour_enquiry: {
        t: ['Visite client', 'Demande de visite', 'Un futur membre souhaitant visiter la salle.'],
        f: { contact_name: ['Nom', 'Nom complet'], email: ['E-mail'], preferred_at: ['Date de visite souhaitée'],
             comments: ['Commentaires', 'Ce qui a été mentionné…'] },
      },
    },
  },

  es: {
    groups: { Registers: 'Registros', Enquiries: 'Solicitudes' },
    severity: { low: 'Baja', medium: 'Media', high: 'Alta' },
    enquiry: { new: 'Nueva', contacted: 'Contactada', closed: 'Cerrada' },
    forms: {
      complaints: {
        t: ['Quejas', 'Queja', 'Registra quejas de socios o visitantes y haz su seguimiento hasta resolverlas.'],
        s: { open: 'Abierta', in_progress: 'En curso', resolved: 'Resuelta' },
        f: { complainant_name: ['Nombre del reclamante', 'p. ej. J. García'], complainant_contact: ['Contacto (teléfono/email)', 'Opcional'],
             category: ['Categoría'], severity: ['Gravedad'], description: ['Qué ha pasado', 'Describe la queja…'] },
        o: { category: { cleanliness: 'Limpieza', staff: 'Personal / servicio', equipment: 'Equipamiento',
                         facilities: 'Instalaciones', billing: 'Facturación / cuota', other: 'Otro' } },
      },
      lost_found: {
        t: ['Objetos perdidos', 'Objeto', 'Registra los objetos encontrados con una foto y márcalos cuando los recojan.'],
        s: { unclaimed: 'Sin reclamar', claimed: 'Recogido', disposed: 'Desechado' },
        f: { item_description: ['Descripción del objeto', 'p. ej. Funda negra de AirPods'], found_location: ['Dónde se encontró', 'p. ej. Estudio 2'],
             comments: ['Comentarios', 'Cualquier otro detalle…'] },
        prompt: 'Recogido por (nombre)',
      },
      incidents: {
        t: ['Incidentes', 'Incidente', 'Registra incidentes, lesiones y cuasi accidentes con todo detalle.'],
        s: { open: 'Abierto', in_progress: 'En revisión', resolved: 'Cerrado' },
        f: { incident_at: ['Cuándo ocurrió'], category: ['Tipo'], severity: ['Gravedad'],
             persons_involved: ['Personas implicadas', 'Nombres / funciones'], description: ['Qué ha pasado', 'Detalle completo del incidente…'],
             action_taken: ['Medidas tomadas', 'Qué se hizo en el momento…'] },
        o: { category: { injury: 'Lesión', near_miss: 'Cuasi accidente', security: 'Seguridad',
                         equipment: 'Avería de equipo', property: 'Bienes / daños', other: 'Otro' } },
      },
      visitors: {
        t: ['Libro de visitas', 'Visitante', 'Registra la entrada de los visitantes y su salida cuando se vayan.'],
        s: { on_site: 'En el centro', signed_out: 'Ha salido' },
        f: { visitor_name: ['Nombre del visitante', 'Nombre completo'], company: ['Empresa / organización', 'Opcional'],
             purpose: ['Motivo de la visita', 'p. ej. Contratista'], comments: ['Notas', 'Algo a destacar…'] },
      },
      pt_enquiry: {
        t: ['Solicitud de entrenador', 'Solicitud de entrenador', 'Un entrenador personal que quiere trabajar con GYMPODS.'],
        f: { contact_name: ['Nombre del entrenador', 'Nombre completo'], email: ['Email'], phone: ['Móvil'],
             preferred_at: ['Fecha preferida'], comments: ['Comentarios', 'Qué consulta…'] },
      },
      pt_client_request: {
        t: ['Cliente quiere entrenador', 'Petición de entrenador', 'Un cliente que quiere que le asignen un entrenador personal.'],
        f: { contact_name: ['Nombre del cliente', 'Nombre completo'], email: ['Email'], preferred_at: ['Fecha preferida'],
             comments: ['Comentarios', 'Objetivos / qué busca…'] },
      },
      tour_enquiry: {
        t: ['Visita de cliente', 'Solicitud de visita', 'Un posible socio que quiere visitar el gimnasio.'],
        f: { contact_name: ['Nombre', 'Nombre completo'], email: ['Email'], preferred_at: ['Fecha preferida para la visita'],
             comments: ['Comentarios', 'Lo que haya comentado…'] },
      },
    },
  },

  it: {
    groups: { Registers: 'Registri', Enquiries: 'Richieste' },
    severity: { low: 'Bassa', medium: 'Media', high: 'Alta' },
    enquiry: { new: 'Nuova', contacted: 'Contattata', closed: 'Chiusa' },
    forms: {
      complaints: {
        t: ['Reclami', 'Reclamo', 'Registra i reclami di clienti e visitatori e seguili fino alla risoluzione.'],
        s: { open: 'Aperto', in_progress: 'In corso', resolved: 'Risolto' },
        f: { complainant_name: ['Nome di chi reclama', 'es. M. Rossi'], complainant_contact: ['Contatto (telefono/email)', 'Facoltativo'],
             category: ['Categoria'], severity: ['Gravità'], description: ['Cosa è successo', 'Descrivi il reclamo…'] },
        o: { category: { cleanliness: 'Pulizia', staff: 'Personale / servizio', equipment: 'Attrezzatura',
                         facilities: 'Strutture', billing: 'Pagamenti / abbonamento', other: 'Altro' } },
      },
      lost_found: {
        t: ['Oggetti smarriti', 'Oggetto', 'Registra gli oggetti trovati con una foto e segnali quando vengono ritirati.'],
        s: { unclaimed: 'Non reclamato', claimed: 'Ritirato', disposed: 'Smaltito' },
        f: { item_description: ["Descrizione dell'oggetto", 'es. Custodia AirPods nera'], found_location: ['Dove è stato trovato', 'es. Studio 2'],
             comments: ['Commenti', 'Altri dettagli…'] },
        prompt: 'Ritirato da (nome)',
      },
      incidents: {
        t: ['Incidenti', 'Incidente', 'Registra incidenti, infortuni e mancati incidenti in modo dettagliato.'],
        s: { open: 'Aperto', in_progress: 'In revisione', resolved: 'Chiuso' },
        f: { incident_at: ['Quando è successo'], category: ['Tipo'], severity: ['Gravità'],
             persons_involved: ['Persone coinvolte', 'Nomi / ruoli'], description: ['Cosa è successo', "Descrizione completa dell'incidente…"],
             action_taken: ['Azioni intraprese', 'Cosa è stato fatto sul momento…'] },
        o: { category: { injury: 'Infortunio', near_miss: 'Mancato incidente', security: 'Sicurezza',
                         equipment: 'Guasto attrezzatura', property: 'Beni / danni', other: 'Altro' } },
      },
      visitors: {
        t: ['Registro visitatori', 'Visitatore', "Registra l'ingresso dei visitatori e poi la loro uscita."],
        s: { on_site: 'In sede', signed_out: 'Uscito' },
        f: { visitor_name: ['Nome del visitatore', 'Nome completo'], company: ['Azienda / organizzazione', 'Facoltativo'],
             purpose: ['Motivo della visita', 'es. Fornitore'], comments: ['Note', 'Qualcosa da segnalare…'] },
      },
      pt_enquiry: {
        t: ['Richiesta PT', 'Richiesta PT', 'Un personal trainer che vuole lavorare con GYMPODS.'],
        f: { contact_name: ['Nome del PT', 'Nome completo'], email: ['Email'], phone: ['Cellulare'],
             preferred_at: ['Data preferita'], comments: ['Commenti', 'Di cosa si informa…'] },
      },
      pt_client_request: {
        t: ['Cliente vuole un PT', 'Richiesta PT', 'Un cliente che vuole essere abbinato a un personal trainer.'],
        f: { contact_name: ['Nome del cliente', 'Nome completo'], email: ['Email'], preferred_at: ['Data preferita'],
             comments: ['Commenti', 'Obiettivi / cosa cerca…'] },
      },
      tour_enquiry: {
        t: ['Visita cliente', 'Richiesta di visita', 'Un potenziale cliente che vuole visitare la palestra.'],
        f: { contact_name: ['Nome', 'Nome completo'], email: ['Email'], preferred_at: ['Data preferita per la visita'],
             comments: ['Commenti', 'Quello che ha detto…'] },
      },
    },
  },

  pt: {
    groups: { Registers: 'Registos', Enquiries: 'Pedidos' },
    severity: { low: 'Baixa', medium: 'Média', high: 'Alta' },
    enquiry: { new: 'Novo', contacted: 'Contactado', closed: 'Fechado' },
    forms: {
      complaints: {
        t: ['Reclamações', 'Reclamação', 'Registe reclamações de sócios ou visitantes e acompanhe-as até à resolução.'],
        s: { open: 'Aberta', in_progress: 'Em curso', resolved: 'Resolvida' },
        f: { complainant_name: ['Nome do reclamante', 'ex. J. Silva'], complainant_contact: ['Contacto (telefone/email)', 'Opcional'],
             category: ['Categoria'], severity: ['Gravidade'], description: ['O que aconteceu', 'Descreva a reclamação…'] },
        o: { category: { cleanliness: 'Limpeza', staff: 'Pessoal / serviço', equipment: 'Equipamento',
                         facilities: 'Instalações', billing: 'Faturação / inscrição', other: 'Outro' } },
      },
      lost_found: {
        t: ['Perdidos e achados', 'Objeto', 'Registe objetos encontrados com uma fotografia e marque-os quando forem recolhidos.'],
        s: { unclaimed: 'Não reclamado', claimed: 'Recolhido', disposed: 'Eliminado' },
        f: { item_description: ['Descrição do objeto', 'ex. Estojo de AirPods preto'], found_location: ['Onde foi encontrado', 'ex. Estúdio 2'],
             comments: ['Comentários', 'Outros detalhes…'] },
        prompt: 'Recolhido por (nome)',
      },
      incidents: {
        t: ['Incidentes', 'Incidente', 'Registe incidentes, lesões e quase-acidentes com todo o detalhe.'],
        s: { open: 'Aberto', in_progress: 'Em análise', resolved: 'Fechado' },
        f: { incident_at: ['Quando aconteceu'], category: ['Tipo'], severity: ['Gravidade'],
             persons_involved: ['Pessoas envolvidas', 'Nomes / funções'], description: ['O que aconteceu', 'Detalhe completo do incidente…'],
             action_taken: ['Medidas tomadas', 'O que foi feito no momento…'] },
        o: { category: { injury: 'Lesão', near_miss: 'Quase-acidente', security: 'Segurança',
                         equipment: 'Avaria de equipamento', property: 'Bens / danos', other: 'Outro' } },
      },
      visitors: {
        t: ['Livro de visitas', 'Visitante', 'Registe a entrada dos visitantes e depois a saída.'],
        s: { on_site: 'No local', signed_out: 'Saiu' },
        f: { visitor_name: ['Nome do visitante', 'Nome completo'], company: ['Empresa / organização', 'Opcional'],
             purpose: ['Motivo da visita', 'ex. Prestador de serviços'], comments: ['Notas', 'Algo a registar…'] },
      },
      pt_enquiry: {
        t: ['Pedido de PT', 'Pedido de PT', 'Um personal trainer interessado em trabalhar com o GYMPODS.'],
        f: { contact_name: ['Nome do PT', 'Nome completo'], email: ['Email'], phone: ['Telemóvel'],
             preferred_at: ['Data preferida'], comments: ['Comentários', 'O que pretende saber…'] },
      },
      pt_client_request: {
        t: ['Cliente quer um PT', 'Pedido de PT', 'Um cliente que quer um personal trainer.'],
        f: { contact_name: ['Nome do cliente', 'Nome completo'], email: ['Email'], preferred_at: ['Data preferida'],
             comments: ['Comentários', 'Objetivos / o que procura…'] },
      },
      tour_enquiry: {
        t: ['Visita de cliente', 'Pedido de visita', 'Um potencial sócio que quer visitar o ginásio.'],
        f: { contact_name: ['Nome', 'Nome completo'], email: ['Email'], preferred_at: ['Data preferida da visita'],
             comments: ['Comentários', 'O que mencionou…'] },
      },
    },
  },
}

/**
 * A copy of one register's config with its wording in `lang`.
 * Values, tables and logic are untouched. Also carries translated
 * severity options as `severityOptions`.
 */
export function localiseRegister(cfg, lang) {
  const L = FORM_LANG[lang]
  const sev = SEVERITY_OPTIONS.map(o => ({ ...o, label: L?.severity?.[o.value] || o.label }))
  if (!cfg || !L) return cfg ? { ...cfg, severityOptions: sev } : cfg
  const F = L.forms[cfg.key] || {}
  const isEnquiry = cfg.statuses === ENQUIRY_STATUSES
  return {
    ...cfg,
    label:    F.t?.[0] || cfg.label,
    singular: F.t?.[1] || cfg.singular,
    blurb:    F.t?.[2] || cfg.blurb,
    groupLabel: L.groups?.[cfg.group] || cfg.group,
    severityOptions: sev,
    statuses: cfg.statuses.map(s => ({
      ...s, label: (isEnquiry ? L.enquiry?.[s.value] : F.s?.[s.value]) || s.label,
    })),
    promptOnStatus: cfg.promptOnStatus
      ? { ...cfg.promptOnStatus, label: F.prompt || cfg.promptOnStatus.label }
      : cfg.promptOnStatus,
    fields: cfg.fields.map(f => ({
      ...f,
      label:       F.f?.[f.name]?.[0] || f.label,
      placeholder: F.f?.[f.name]?.[1] || f.placeholder,
      options: f.options?.map(o => ({ ...o, label: F.o?.[f.name]?.[o.value] || o.label })),
    })),
  }
}

/** Translated group heading for the dropdown ('Registers' → 'Registos'). */
export const localiseGroup = (group, lang) => FORM_LANG[lang]?.groups?.[group] || group
