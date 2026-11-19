// Reads the folder and file names of the documents archive. Pure functions, no file access.
//
// Layout: "<NN>- <region>" / "<region> <minute>" / "<heading>" / [sub folder /] file
// Headings: اشارات (annotations), بيانات عقارية (records), زيارات ميدانية (visits), عقود شراء (purchase contracts).
// A survey statement (بيان مساحي) sits directly in the parcel folder, with no heading.

export const CATEGORY_BY_HEADING = {
  اشارات: 'annotations',
  إشارات: 'annotations',
  'بيانات عقارية': 'records',
  'زيارات ميدانية': 'visits',
  'عقود شراء': 'contracts',
}

const MIME = {
  '.pdf': ['application/pdf', 'pdf'],
  '.jpg': ['image/jpeg', 'image'],
  '.jpeg': ['image/jpeg', 'image'],
  '.png': ['image/png', 'image'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'sheet'],
  '.xls': ['application/vnd.ms-excel', 'sheet'],
}

/** The category of a file: its heading's, or for a file with no heading, what its name says. */
export function categoryOf(heading, fileName) {
  if (heading && CATEGORY_BY_HEADING[heading]) return CATEGORY_BY_HEADING[heading]
  if (!heading && /بيان مساحي/.test(fileName)) return 'surveys'
  return 'other'
}

/** "07- ماير" -> "ماير" */
export function regionFromRoot(folderName) {
  return folderName.replace(/^\s*\d+\s*-\s*/, '').trim()
}

/** "ماير 1157" -> { minuteText: "1157", minuteBase: 1157 }; null when the folder is not a parcel folder of that region. */
export function parcelFromFolder(folderName, region) {
  const rest = folderName.startsWith(region) ? folderName.slice(region.length).trim() : folderName.trim()
  const match = rest.match(/^(\d+)/)
  return match ? { minuteText: rest, minuteBase: Number(match[1]) } : null
}

export function fileType(ext) {
  const [mime, kind] = MIME[ext.toLowerCase()] ?? ['application/octet-stream', 'other']
  return { mime, kind }
}

/** "04-01-2011" (day-month-year) -> "2011-01-04", or null when it is not a real date. */
export function isoFromDayMonthYear(day, month, year) {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCMonth() !== m - 1) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const stripExtension = (name) => name.replace(/\.[^.]+$/, '')

/**
 * What a file is, from its heading and its name: a readable title, the date written in the name, and the
 * annotation number when it is an annotation. Unknown shapes keep their file name as the title.
 */
export function describeFile(fileName, category) {
  const base = stripExtension(fileName).trim()
  const ext = (fileName.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase()
  const { kind } = fileType(ext)

  const annotation = base.match(/اشارة\s*(\d+)\s*-\s*(.+)$/)
  const annotationRef = annotation ? Number(annotation[1]) : null
  const date = base.match(/(\d{1,2})-(\d{1,2})-(\d{4})/)
  const docDate = date ? isoFromDayMonthYear(date[1], date[2], date[3]) : null
  const dateLabel = docDate ? docDate.split('-').reverse().join('/') : null

  if (annotation) return { title: `إشارة ${annotation[1]} — ${annotation[2].trim()}`, annotationRef, docDate, kind }
  if (/بيان مساحي/.test(base)) {
    // "ماير 1243+1244 مدمج مع 1242 - بيان مساحي ...": minutes merged into the parcel whose folder holds the file
    const merged = base.match(/ماير\s+(.+?)\s+(مدمج مع\s+\d+)/) ?? base.match(/(\S+)\s+(مدمج مع\s+\d+)/)
    const note = merged ? ` (${merged[1].replace(/^ماير\s*/, '')} ${merged[2]})` : ''
    return { title: `${dateLabel ? `بيان مساحي ${dateLabel}` : 'بيان مساحي'}${note}`, annotationRef: null, docDate, kind }
  }
  if (/بيان عقاري/.test(base)) return { title: dateLabel ? `بيان عقاري ${dateLabel}` : 'بيان عقاري', annotationRef: null, docDate, kind }
  if (/عقد شراء/.test(base)) {
    const note = base.match(/عقد شراء\s*-\s*(.+)$/)
    return { title: note ? `عقد شراء — ${note[1].trim()}` : 'عقد شراء', annotationRef: null, docDate, kind }
  }
  if (category === 'visits' && kind === 'sheet') return { title: 'جدول الزيارة الميدانية', annotationRef: null, docDate, kind }
  if (category === 'visits' && kind === 'image') return { title: 'صورة زيارة ميدانية', annotationRef: null, docDate, kind }
  return { title: base, annotationRef: null, docDate, kind }
}

/** Where a file sits, from its path parts (relative to the region folder). */
export function locate(parts) {
  if (parts.length === 1) return { scope: 'region', parcelFolder: null, heading: null, subFolder: null, fileName: parts[0] }
  const [parcelFolder, second, ...rest] = parts
  // Two parts: the file sits directly in the parcel folder, so there is no heading.
  if (parts.length === 2) return { scope: 'parcel', parcelFolder, heading: null, subFolder: null, fileName: second }
  const heading = second
  const fileName = rest[rest.length - 1]
  const subFolder = rest.length > 1 ? rest.slice(0, -1).join(' / ') : null
  return { scope: 'parcel', parcelFolder, heading, subFolder, fileName }
}
