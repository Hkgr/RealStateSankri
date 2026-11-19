import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categoryOf, describeFile, fileType, isoFromDayMonthYear, locate, parcelFromFolder, regionFromRoot } from '../src/documents/classify.js'

test('region and parcel come from the folder names', () => {
  assert.equal(regionFromRoot('07- ماير'), 'ماير')
  assert.equal(regionFromRoot('12 - كفر بسين'), 'كفر بسين')
  assert.deepEqual(parcelFromFolder('ماير 1157', 'ماير'), { minuteText: '1157', minuteBase: 1157 })
  assert.deepEqual(parcelFromFolder('ماير 1431 متضرر', 'ماير'), { minuteText: '1431 متضرر', minuteBase: 1431 })
  assert.equal(parcelFromFolder('ماير عدة محاضر', 'ماير'), null)
})

test('day-month-year dates are validated', () => {
  assert.equal(isoFromDayMonthYear('04', '01', '2011'), '2011-01-04')
  assert.equal(isoFromDayMonthYear('31', '02', '2011'), null)
  assert.equal(isoFromDayMonthYear('01', '13', '2011'), null)
})

test('file types', () => {
  assert.deepEqual(fileType('.PDF'), { mime: 'application/pdf', kind: 'pdf' })
  assert.equal(fileType('.jpg').kind, 'image')
  assert.equal(fileType('.xlsx').kind, 'sheet')
  assert.equal(fileType('.zip').kind, 'other')
})

test('an annotation file gives its number and a readable title', () => {
  const file = describeFile('ماير عدة محاضر - اشارة 2424 - فلان الفلاني.pdf', 'annotations')
  assert.equal(file.annotationRef, 2424)
  assert.equal(file.title, 'إشارة 2424 — فلان الفلاني')
  assert.equal(file.kind, 'pdf')
})

test('a land-registry statement gives its date', () => {
  const file = describeFile('ماير 1157 - بيان عقاري 01-07-2026.pdf', 'records')
  assert.equal(file.title, 'بيان عقاري 01/07/2026')
  assert.equal(file.docDate, '2026-07-01')
  assert.equal(describeFile('ماير عدة محاضر - بيان عقاري ت 04-01-2011.pdf', 'records').docDate, '2011-01-04')
})

test('purchase contracts, with an optional note', () => {
  assert.equal(describeFile('ك16 - ماير 1157 - عقد شراء.pdf', 'contracts').title, 'عقد شراء')
  assert.equal(describeFile('ك16 - ماير 1157 - عقد شراء - ملاحظة.pdf', 'contracts').title, 'عقد شراء — ملاحظة')
})

test('field visits: photos and the sheet', () => {
  assert.equal(describeFile('1780386197369.jpg', 'visits').title, 'صورة زيارة ميدانية')
  assert.equal(describeFile('(1154 , 1155) ماير مجموعة محاضر متلاصقة.xlsx', 'visits').title, 'جدول الزيارة الميدانية')
})

test('an unknown name keeps its file name', () => {
  const file = describeFile('شيء آخر.pdf', 'other')
  assert.equal(file.title, 'شيء آخر')
  assert.equal(file.annotationRef, null)
})

test('locate reads the folder levels', () => {
  assert.deepEqual(locate(['ملف على مستوى المنطقة.pdf']), { scope: 'region', parcelFolder: null, heading: null, subFolder: null, fileName: 'ملف على مستوى المنطقة.pdf' })
  assert.deepEqual(locate(['ماير 1154', 'اشارات', 'a.pdf']), { scope: 'parcel', parcelFolder: 'ماير 1154', heading: 'اشارات', subFolder: null, fileName: 'a.pdf' })
  assert.deepEqual(locate(['ماير 1154', 'زيارات ميدانية', 'صور', 'x.jpg']), { scope: 'parcel', parcelFolder: 'ماير 1154', heading: 'زيارات ميدانية', subFolder: 'صور', fileName: 'x.jpg' })
})

test('a survey statement sits directly in the parcel folder', () => {
  assert.deepEqual(locate(['ماير 1154', 'ماير 1154 - بيان مساحي ت 22-07-2026.pdf']), { scope: 'parcel', parcelFolder: 'ماير 1154', heading: null, subFolder: null, fileName: 'ماير 1154 - بيان مساحي ت 22-07-2026.pdf' })
  assert.equal(categoryOf(null, 'ماير 1154 - بيان مساحي ت 22-07-2026.pdf'), 'surveys')
  assert.equal(categoryOf('اشارات', 'x.pdf'), 'annotations')
  assert.equal(categoryOf(null, 'ملف آخر.pdf'), 'other')
  const file = describeFile('ماير 1154 - بيان مساحي ت 22-07-2026.pdf', 'surveys')
  assert.equal(file.title, 'بيان مساحي 22/07/2026')
  assert.equal(file.docDate, '2026-07-22')
})

test('a survey statement of merged minutes says so', () => {
  const file = describeFile('ماير 1243+1244+1246 مدمج مع 1242 - بيان مساحي ت 09-08-2026.pdf', 'surveys')
  assert.equal(file.title, 'بيان مساحي 09/08/2026 (1243+1244+1246 مدمج مع 1242)')
})
