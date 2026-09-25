export const NAV_ITEMS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h7v7h-7z M14 3h7v7h-7z M3 14h7v7h-7z M14 14h7v7h-7z" /></svg>',
  },
  {
    id: 'client',
    label: 'Client Questionnaire',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1z M8 12h8 M8 16h8" /></svg>',
  },
  {
    id: 'broker',
    label: 'Broker Questionnaire',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M2 13h20" /></svg>',
  },
  {
    id: 'deliverables',
    label: 'Deliverables & Timeline',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M2 10h20 M8 3v4 M16 3v4 M8.5 15l2 2 4.5-4.5" /></svg>',
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></svg>',
  },
  {
    id: 'what-to-expect',
    label: 'What to Expect',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6 M10 21h4 M12 2a7 7 0 0 0-4 12.6V17h8v-2.4A7 7 0 0 0 12 2z" /></svg>',
  },
  {
    id: 'documents',
    label: 'Document Center',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z M14 3v6h6" /></svg>',
  },
];

export const CLIENT_DATA = {
  companyName: 'Acme Manufacturing Co.',
  address: '482 Foundry Road, Suite 200, Cedar Falls, IA 50613',
  taxId: '42-1893765',
  sicCode: '3612',
  orgType: 'C-Corp',
  companySize: '214',
  locations: '1',
  effectiveDate: '2026-08-10',
  waitingPeriod: '1st of the month following 30 days after hire',
  excludedClasses: ['Part-Time'],
  hpNetwork: '39North Network',
  nationalNetwork: 'Logro Network',
  mainContact: {
    name: 'Denise Whitfield',
    title: 'VP of HR',
    phone: '(319) 555-0142',
    email: 'dwhitfield@acmemfg.com',
    signatory: true,
    billing: false,
  },
  contacts: [
    {
      name: 'Denise Whitfield',
      title: 'VP of HR',
      role: 'Primary decision-maker and document signer',
      phone: '(319) 555-0142',
      email: 'dwhitfield@acmemfg.com',
      signatory: true,
    },
    {
      name: 'Marcus Boyle',
      title: 'Controller',
      role: 'Billing and invoice questions',
      phone: '(319) 555-0198',
      email: 'mboyle@acmemfg.com',
      signatory: false,
    },
  ],
  notes: 'Acme prefers two open enrollment sessions at shift changes.',
};

export const BROKER_DATA = {
  brokerName: 'Heartland Benefits Group',
  firmName: 'Heartland Benefits Group',
  firmAddress: '120 Broker Lane, Des Moines, IA 50309',
  firmTaxId: '27-3344556',
  contacts: [
    {
      name: 'Karen Delgado',
      title: 'Senior Broker',
      role: 'Plan design, enrollment, and renewal support',
      phone: '(515) 555-0173',
      email: 'karen@heartland.com',
    },
  ],
  notes: 'Broker notes go here.',
  vendorIntegration: {
    required: 'no',
    platform: '',
    cobraVendorName: '',
    cobraVendorContact: '',
    cobraVendorPhone: '',
    cobraVendorEmail: '',
  },
};

// External partners (TPA, PBM, stoploss carrier, ...) who each require their own contracts and
// have their own support contact. Placeholder entries — replace with real vendor contacts.
export const PARTNER_CONTACTS = [
  {
    org: 'Meridian TPA Services',
    category: 'TPA',
    name: 'Renee Castillo',
    title: 'Account Manager',
    role: 'Claims processing, eligibility, and ID card issues',
    phone: '(800) 555-0161',
    email: 'renee.castillo@meridiantpa.example',
  },
  {
    org: 'ClearScript Pharmacy Solutions',
    category: 'PBM',
    name: 'Owen Baptiste',
    title: 'Client Success Manager',
    role: 'Pharmacy benefit design and formulary questions',
    phone: '(800) 555-0184',
    email: 'owen.baptiste@clearscriptrx.example',
  },
  {
    org: 'Highwater Re',
    category: 'Stoploss Carrier',
    name: 'Priya Nandakumar',
    title: 'Underwriting Contact',
    role: 'Stoploss policy, claims, and reinsurance questions',
    phone: '(800) 555-0197',
    email: 'priya.nandakumar@highwaterre.example',
  },
];

export const STANDARD_DELIVERABLES = {
  pre: [
    { name: 'Sign and accept stoploss rate sheet; select plan designs', rule: '45 days before effective date', note: '' },
    { name: 'Collect group and broker W9s & banking information', rule: '30 days before effective date', note: '' },
    { name: 'Receive Summary of Benefits and Coverage for selected plans', rule: '30 days before effective date', note: '' },
    { name: 'Host open enrollment meetings with employees', rule: '30 days before effective date', note: '' },
    { name: 'Submit final enrollment census after open enrollment', rule: '20 days before effective date', note: '' },
    { name: 'Receive and sign final rates', rule: '14 days before effective date', note: '⚠️ Note: Rates may change based on final enrollment' },
    { name: 'Sign Master Stoploss Policy', rule: '10 days before effective date', note: '🔴 Alert: Required to send ID cards' },
    { name: 'Sign ACH Authorization document', rule: '10 days before effective date', note: '🔴 Alert: Required to send ID cards' },
    { name: 'Sign Stoploss Application and Disclosure Form', rule: '10 days before effective date', note: '🔴 Alert: Required to send ID cards' },
    { name: 'Receive and review first premium invoice', rule: '10 days before effective date', note: '⚠️ Note: Recommend detailed review for accuracy' },
  ],
  post: [
    { name: 'Receive virtual ID cards', rule: 'On effective date', note: '' },
    { name: 'Receive physical ID cards (shipped to member addresses)', rule: 'Within 20 days after effective date', note: '' },
    { name: 'Review and sign the issued stoploss policy', rule: '20 days after effective date', note: '' },
    { name: 'Review and sign Aggregate Accommodation policy, Advance Specific Excess Loss Agreement, and Indemnity Agreement', rule: '20 days after effective date', note: '' },
    { name: 'Receive and sign Summary Plan Documents', rule: 'Within 60 days after effective date', note: 'Note: In-depth plan coverage and exclusion documents' },
    { name: 'Sign Administrative Services Agreement Bundle (TPA, PBM, BAA/HIPAA contracts)', rule: 'Within 90 days after effective date', note: '' },
  ],
};

// Audience tags shown on each group of expectations (and used to filter the page).
export const EXPECTATION_AUDIENCES = ['Employer', 'Members', 'Broker'];

export const EXPECTATION_GROUPS = [
  {
    id: 'general',
    title: 'General Transition Expectations',
    audience: 'Employer',
    items: [
      {
        title: 'Final Rate Changes May Occur',
        body: 'Final rates may change with a final enrollment census. Stoploss reserves the right to adjust rates if the enrollment changes by more than 10% from the sold quote to the final enrollment, or if significant new medical risk is present.',
      },
      {
        title: 'AI-Based Underwriting Notice',
        body: 'If applicable, AI-based underwriting will almost always change slightly with a final enrollment census. Talk to your implementation manager if you have any questions about these adjustments.',
      },
      {
        title: 'Timelines Are Subject to Change',
        body: 'Timelines are estimates and may be adjusted depending on when the previous item is received. Please note that any custom solutions will impact timelines.',
      },
      {
        title: 'Audit Your First Invoice',
        body: 'Please make sure to always check the first invoice for accuracy, both regarding plan rates and enrollment. Members not included on the final enrollment census will not be enrolled at the effective date. We recommend NOT downloading your final enrollment census from your payroll system, which frequently misses COBRA members.',
      },
      {
        title: 'Alert Your Bank',
        body: 'To avoid any delays with claims payment, please alert your bank that an ACH pull will be coming from our TPA.',
      },
      {
        title: 'ID Cards',
        body: 'Members will receive ID cards with ONLY the subscriber\'s information. All members will use the same ID card. We do this to improve billing accuracy.',
      },
      {
        title: 'COBRA Members',
        body: 'Please make sure you if you are pulling census data from your payroll system to include any active COBRA members. If census information omits COBRA members on the final census, COBRA members will NOT be eligible for coverage.',
      },
    ],
  },
  {
    id: 'member',
    title: 'Member Transition Expectations',
    audience: 'Members',
    items: [
      {
        title: 'Expect a Transition',
        body: 'We are a unique solution in the market, so expect some disruption among members. This is normal, and our care coordination team will be very involved in solving any confusion or issues that members experience, especially in the first few months.',
      },
      {
        title: 'Our "Guardrails"',
        body: 'We purposefully put in place "Guardrails" in our plan to prevent you from unknowingly spending more money on medical services than you need. If you encounter an issue or a denial, it is likely due to one of these guardrails. You may receive a call from us offering alternative options to save you money.',
      },
      {
        title: 'Member Support Channels',
        body: 'Make sure members know they can reach out directly to Hello@39N.CO or the number on their ID card with any issues. They will speak with a live person.',
      },
      {
        title: 'HR Cannot Assist with Medical Issues',
        body: 'Let members know that reaching out to HR for issues is NOT recommended. HR will not likely be able to assist them with medical, billing, or other insurance issues.',
      },
      {
        title: 'New Prior Authorizations',
        body: 'As with any health plan transition, members will need to get updated Prior Authorizations. We will deny advanced medical and pharmacy services without one. Have members speak with their providers to see if one is required for their medical needs.',
      },
      {
        title: 'Direct & Advanced Primary Care',
        body: 'We include advanced primary care solutions on most plans. These are free and unlimited to members, and are subsidized by the plan. If applicable, please make sure members are aware of these amazing benefits.',
      },
      {
        title: 'Review All Bills',
        body: 'We recommend members take 30 seconds to review all bills and EOBs they receive. If services or payments look incorrect, or you have a question, please feel free to reach out to us.',
      },
      {
        title: 'If a Provider Hasn\'t Heard of Us',
        body: 'Please have your provider call the number on your ID card. We have several partnerships with other carriers to access networks, and not every provider has heard of us.',
      },
      {
        title: 'If You Receive a Medical Denial',
        body: 'The most common reason for medical denials is a lack of Prior Authorization. Please have your provider read the denial reason, and call us to get this fixed. More often than not, a denial is temporary.',
      },
      {
        title: 'If You Receive a Pharmacy Denial',
        body: 'Most Rx denials are due to medication triggering our "Rate Limit." We put this in place because many pharmacies charge 3–5x more than the medication\'s fair market value. Please have the pharmacist read the denial notice to you, and either call the number on the denial or the number on your ID card.',
      },
    ],
  },
  {
    id: 'broker',
    title: 'Broker Expectations',
    audience: 'Broker',
    items: [
      {
        title: 'Commissions',
        body: 'It is common for first commissions to be paid out 2–3 months after the effective date. Implementation delays may cause first commissions to be paid later.',
      },
      {
        title: 'Aggregate Reports & Plan Data',
        body: 'This information is provided online via our TPA portal. First data reports are usually produced about 3 months after the effective date due to claims lag. Subsequent reports will be produced about 3–4 weeks after the end of the plan month.',
      },
      {
        title: 'Renewals',
        body: 'We will frequently submit renewal rates more than 60 days before the renewal date. However, this may depend on plan performance and if our underwriting teams require additional experience to provide the most competitive rates. We will work with your team to produce renewals in a timely manner.',
      },
      {
        title: 'Transparency Tools',
        body: 'We have transparency tools available to clients for an additional fee. We will submit proper paperwork to government entities on your behalf, so you don\'t have to file this additional paperwork.',
      },
    ],
  },
];

export const HEALTH_CONTACTS = [
  {
    name: 'Maya Thompson',
    title: 'Implementation Manager',
    role: 'Your main contact for implementation status, timelines, and questions',
    phone: '(515) 555-0137',
    email: 'maya@39nhealth.com',
  },
  {
    name: 'Jordan Lee',
    title: 'Client Success Specialist',
    role: 'Post-implementation support and renewal planning',
    phone: '(515) 555-0145',
    email: 'jordan@39nhealth.com',
  },
];

export const DOCUMENTS = [
  {
    name: 'Summary Plan Document',
    owner: 'Benefits Team',
    status: 'Ready',
    category: 'plan-documents',
    updated: '2026-07-15',
  },
  {
    name: 'Stoploss Policy Package',
    owner: 'Carrier Partner',
    status: 'Pending signature',
    category: 'contracts-agreements',
    updated: '2026-07-22',
  },
  {
    name: 'Enrollment Materials',
    owner: 'Implementation Team',
    status: 'Published',
    category: 'resources-education',
    updated: '2026-08-01',
  },
  {
    name: 'Broker and Employer Worksheets',
    owner: 'Broker Team',
    status: 'Shared',
    category: 'resources-education',
    updated: '2026-08-03',
  },
];

export function computeDueDate(effectiveDateStr, rule) {
  if (!effectiveDateStr) return '';

  const parsed = new Date(effectiveDateStr);
  if (Number.isNaN(parsed.getTime())) return '';

  // Parsed as UTC midnight, so all day arithmetic below must use UTC methods
  // (local-time setDate shifts the result by a day across DST changes).
  const eff = new Date(parsed);
  const r = rule.toLowerCase();

  if (r.includes('on effective date')) {
    return eff.toISOString().slice(0, 10);
  }

  const beforeMatch = r.match(/(\d+)\s*days?\s*before/);
  if (beforeMatch) {
    const days = Number(beforeMatch[1]);
    const next = new Date(eff);
    next.setUTCDate(next.getUTCDate() - days);
    return next.toISOString().slice(0, 10);
  }

  const afterMatch = r.match(/(?:within\s*)?(\d+)\s*days?\s*after/);
  if (afterMatch) {
    const days = Number(afterMatch[1]);
    const next = new Date(eff);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }

  return '';
}
