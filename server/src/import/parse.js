// Pure helpers that turn the sheet's free-form cells into typed values. No I/O here, so they can be tested.

/** Collapses whitespace and line breaks; empty cells become null. Numbers pass through. */
export function clean(value) {
  if (value == null) return null
  if (typeof value !== 'string') return value
  const text = value.replace(/\s+/g, ' ').trim()
  return text === '' ? null : text
}

/** A numeric cell, or null. Strings that look like numbers are accepted. */
export function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const text = value.replace(/[,\s]/g, '')
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  }
  return null
}

const pad = (n) => String(n).padStart(2, '0')

function isoDate(year, month, day) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCMonth() !== month - 1) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Excel serial day number (1900 system) to an ISO date. */
export function serialToIso(serial) {
  return new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10)
}

/**
 * Every full date written in a text, in order. Accepts d-m-y, d/m/y and y-m-d; day comes
 * before month when the year is last, as everywhere else in the sheet.
 */
export function findDates(text) {
  const found = []
  const pattern = /(\d{1,4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,4})/g
  for (const match of String(text).matchAll(pattern)) {
    const [, a, b, c] = match
    let iso = null
    if (a.length === 4) iso = isoDate(Number(a), Number(b), Number(c))
    else if (c.length === 4) iso = isoDate(Number(c), Number(b), Number(a))
    if (iso) found.push(iso)
  }
  return found
}

/**
 * A date cell in any of its shapes: an Excel serial, a bare year, or text with a date inside.
 * `date` is null when only the year is known; `year` is then still filled.
 */
export function parseDateCell(value) {
  if (value == null || value === '') return { date: null, year: null, raw: null }
  if (typeof value === 'number') {
    if (value >= 20000 && value <= 80000) {
      const date = serialToIso(value)
      return { date, year: Number(date.slice(0, 4)), raw: null }
    }
    if (value >= 1900 && value <= 2100) return { date: null, year: value, raw: null }
    return { date: null, year: null, raw: String(value) }
  }
  const raw = clean(value)
  const [first] = findDates(value)
  if (first) return { date: first, year: Number(first.slice(0, 4)), raw }
  const year = String(value).match(/\b(19|20)\d{2}\b/)
  return { date: null, year: year ? Number(year[0]) : null, raw }
}

/** "فراغة d-m-y" and/or "y-m-d حكم": which route led to د. سنكري's ownership, and when. */
export function parseTransfer(value) {
  const raw = clean(value)
  if (!raw) return { method: null, transferDate: null, judgmentDate: null, raw: null }
  let transferDate = null
  let judgmentDate = null
  let hasTransfer = false
  let hasJudgment = false
  for (const line of String(value).split(/\r?\n/)) {
    const date = findDates(line)[0] ?? null
    if (/حكم/.test(line)) {
      hasJudgment = true
      judgmentDate ??= date
    } else if (/فراغ/.test(line)) {
      hasTransfer = true
      transferDate ??= date
    }
  }
  let method = null
  if (hasJudgment && hasTransfer) method = 'judgment_then_transfer'
  else if (hasJudgment) method = 'judgment'
  else if (hasTransfer) method = 'transfer'
  return { method, transferDate, judgmentDate, raw }
}

const TYPE_TO_CATEGORY = {
  تحكيم: 'arbitration',
  امني: 'security',
  أمني: 'security',
  'تصفية شركة': 'liquidation',
  دولة: 'state',
}

const DERIVE_RULES = [
  ['arbitration', /تحكيم/],
  ['liquidation', /تصفية|حل\s+شركة|حل وتصفية/],
  ['cancellation', /فسخ/],
  ['security', /منع تصرف|حجز احتياطي|امني|أمني/],
  ['state', /استملاك|بلدية|بلديه|مجلس|وزارة|محافظ|قيادة|الجيش|تجميل|توسيع|القانون|إزالة مخالفة/],
]

/** The sheet's own "نوع الإشارة" when present; otherwise guessed from the annotation text. */
export function categorize(placedBy, sheetType) {
  const type = clean(sheetType)
  if (type && TYPE_TO_CATEGORY[type]) return { code: TYPE_TO_CATEGORY[type], source: 'sheet' }
  const text = clean(placedBy) ?? ''
  for (const [code, pattern] of DERIVE_RULES) {
    if (pattern.test(text)) return { code, source: 'derived' }
  }
  return { code: 'private_claim', source: 'derived' }
}

/** "على من وضعت الإشارة": whose shares carry the annotation, and how many shares are named. */
export function parseTarget(value) {
  const text = clean(value)
  if (!text) return { party: null, shares: null }

  const named = new Set()
  for (const match of text.matchAll(/(سنكري|عسلي)\s*[\d.]+\s*سهم/g)) named.add(match[1])
  const mentionsSankari = /سنكري/.test(text)
  const mentionsAsali = /عسلي/.test(text)

  let party
  if (named.size === 2) party = 'both'
  else if (named.size === 1) party = named.has('سنكري') ? 'sankari' : 'asali'
  else if (mentionsSankari && mentionsAsali) party = 'both'
  else if (mentionsSankari) party = 'sankari'
  else if (mentionsAsali) party = 'asali'
  else party = 'other'

  let shares = null
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*سهم/g)) shares = (shares ?? 0) + Number(match[1])
  return { party, shares: shares == null ? null : Math.round(shares * 1000) / 1000 }
}

const TIMING = [
  [/قبل\s+الشراء/, 'before_purchase'],
  [/قبل\s+الفراغ/, 'before_transfer'],
  [/بعد\s+الفراغ/, 'after_transfer'],
  [/قبل\s+الحكم/, 'before_judgment'],
  [/بعد\s+الحكم/, 'after_judgment'],
]

/** "وضعت الأشاره": before or after the transfer / judgment in favour of د. سنكري. */
export function parseTiming(value) {
  const text = clean(value)
  if (!text) return null
  return TIMING.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

/** Who made the purchase: broker, agent, the owner himself, or "no contract" (date taken from accounting). */
export function purchaseChannel(value) {
  const text = clean(value)
  if (!text) return null
  if (/لايوجد عقد/.test(text)) return 'accounting'
  if (/دلال/.test(text)) return 'broker'
  if (/وكيل|\sعن\s/.test(text)) return 'agent'
  if (/^(رياض\s+)?(ال)?عسلي$|^د\.?\s*سنكري$/.test(text)) return 'principal'
  return 'other'
}

/** "اميري / التمام" is full ownership, "اميري / الشيوع" is joint (undivided) ownership. */
export function landStatus(value) {
  const text = clean(value)
  if (!text) return null
  if (/شيوع/.test(text)) return 'joint'
  if (/تمام/.test(text)) return 'full'
  return null
}

export function ownershipGroup(value) {
  const text = clean(value)
  if (!text) return 'unclassified'
  if (/مشاكل/.test(text)) return 'problem'
  if (/سنكري/.test(text) && /عسلي/.test(text)) return 'joint_75_25'
  if (/سنكري/.test(text)) return 'sankari_100'
  if (/عسلي/.test(text)) return 'asali_100'
  return 'unclassified'
}

/** First number in a minute number such as "71 / 16+33+35+36 متضرر". */
export function minuteBase(value) {
  const match = String(value ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}
