/* ============================================================
   Gertrude Hawk Chocolate Bar Fundraiser — single source of config
   Edit values here; chocolate.html reads from this object instead
   of having dates/copy/links scattered through the page markup.
   ============================================================ */
const CHOCOLATE_FUNDRAISER = {
  active: true,
  title: 'Gertrude Hawk Chocolate Bar Fundraiser',
  slug: 'chocolate',
  organizedBy: 'Schalmont PTO',
  tagline: "Supporting Every Sabre's Story",
  participatingSchools: ['Schalmont Middle School', 'Schalmont High School'],

  price: 2.50,
  zeffyUrl: 'https://www.zeffy.com/en-US/ticketing/gertrude-hawk-chocolate-bar-fundraiser-schalmont-pto',

  // Initial inventory plan — shown as context, not a live counter.
  inventory: { carriers: 16, barsPerCarrier: 48 },

  // Typical starter quantity offered to a selling family (a range, not a fixed number).
  sellerBatch: { min: 12, max: 24 },

  // Payment terms with Gertrude Hawk are still being finalized — keep this generic
  // and editable in one place until confirmed. Do not add specific Net-30/45/60 language here.
  paymentTermsNote: 'Payment instructions and any deadline will be shared with participating ' +
    'families once confirmed, and posted here and on the order/pickup paperwork.',
  returnPolicyNote: 'Unsold chocolate return details will be shared directly with sellers. ' +
    'If you have questions, please contact the PTO.',

  // Dates families can expect chocolate to be available at a staffed PTO table —
  // edit this list to add/remove sale opportunities.
  dates: [
    { date: '2026-09-16', label: 'Middle School Open House' },
    { date: '2026-10-01', label: 'High School Open House' },
    { date: '2026-10-16', label: 'Homecoming' },
    { date: '2026-10-30', label: 'Trail of Treats' }
  ],

  contact: { label: 'Contact the PTO', href: 'contact.html' },

  faqs: [
    { q: 'How much are the chocolate bars?', a: '$2.50 each.' },
    { q: 'Who benefits from the fundraiser?', a: 'Schalmont Middle School and High School PTO programs and initiatives.' },
    { q: 'Can my student sell chocolate?', a: 'Yes! Participating Middle and High School students and families can request chocolate to sell using the form on this page.' },
    { q: 'How many bars does a student receive?', a: 'We’re using smaller starter batches — typically around 12–24 bars — so families aren’t required to take a full 48-bar carrier at once.' },
    { q: 'Can we get more bars if we sell out?', a: 'Yes, additional chocolate may be available depending on supply once your first batch is sold and accounted for.' },
    { q: 'Can I return unsold chocolate?', a: 'Unsold chocolate return details will be shared directly with sellers. Please reach out to the PTO with any questions.' },
    { q: 'When is payment due?', a: 'Payment instructions and any deadline will be confirmed and shared with participating families directly, and posted here once finalized.' }
  ],

  social: {
    url: 'https://schalmontpto.com/chocolate',
    title: 'Gertrude Hawk Chocolate Bar Fundraiser | Schalmont PTO',
    description: 'For Schalmont Middle + High School families — sign up to sell Gertrude Hawk chocolate, or order bars or a case to have sent home.',
    image: 'https://schalmontpto.com/images/Schalmont-PTO-logo.png'
  }
};
