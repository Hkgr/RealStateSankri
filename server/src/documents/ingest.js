// Indexes a region's documents folder:  npm run docs:ingest -- --source "D:/path/07- ماير" [--dry-run]
//
// Every file is hashed; each distinct content is stored once under DOCS_DIR (blobs/ab/<sha256>) and described in the
// database, and every place it was filed (parcel, heading, original name) becomes a row linking to it. Anything the
// rules do not recognise is reported, never guessed. Safe to run again: stored files and rows are reused.
import { createReadStream, existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { dbConfig } from '../db.js'
import { categoryOf, describeFile, fileType, locate, parcelFromFolder, regionFromRoot } from './classify.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.resolve(here, '../..')
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? true) : null
}
const source = arg('source')
const dryRun = process.argv.includes('--dry-run')
if (!source || source === true) {
  console.error('الاستخدام: npm run docs:ingest -- --source "<مجلد المنطقة>" [--dry-run]')
  process.exit(1)
}
const storage = path.resolve(serverDir, process.env.DOCS_DIR ?? '../storage/documents')
const region = regionFromRoot(path.basename(path.resolve(source)))

const mb = (n) => `${(n / 1024 ** 2).toFixed(1)} MB`
const gb = (n) => `${(n / 1024 ** 3).toFixed(2)} GB`
const blobPath = (sha) => path.join(storage, 'blobs', sha.slice(0, 2), sha)

async function* walk(dir, parts = []) {
  const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  for (const entry of entries) {
    if (entry.isDirectory()) yield* walk(path.join(dir, entry.name), [...parts, entry.name])
    else yield { full: path.join(dir, entry.name), parts: [...parts, entry.name] }
  }
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')))
  })
}

const connection = await mysql.createConnection({ ...dbConfig, charset: 'utf8mb4', multipleStatements: true })
try {
  const [parcels] = await connection.query(
    'SELECT p.minute_base, p.minute_no FROM parcels p JOIN regions r ON r.id = p.region_id WHERE r.name_ar = ?',
    [region],
  )
  if (parcels.length === 0) throw new Error(`لا عقارات للمنطقة «${region}» في القاعدة. تأكد من اسم المجلد ومن تنفيذ db:import.`)
  const parcelByBase = new Map(parcels.map((p) => [p.minute_base, p.minute_no]))

  console.log(`المصدر: ${source}\nالمنطقة: ${region} (${parcels.length} عقارًا في القاعدة)\nالتخزين: ${storage}\n`)

  // 1) scan and hash
  const items = []
  const unmatchedFolders = new Map()
  const unknownHeadings = new Map()
  for await (const { full, parts } of walk(source)) {
    const stat = await fs.stat(full)
    const where = locate(parts)
    const ext = path.extname(where.fileName).toLowerCase()
    let minuteBase = null
    if (where.scope === 'parcel') {
      const parcel = parcelFromFolder(where.parcelFolder, region)
      if (!parcel || !parcelByBase.has(parcel.minuteBase)) {
        unmatchedFolders.set(where.parcelFolder, (unmatchedFolders.get(where.parcelFolder) ?? 0) + 1)
        continue
      }
      minuteBase = parcel.minuteBase
    }
    const category = where.scope === 'region' ? 'other' : categoryOf(where.heading, where.fileName)
    if (category === 'other' && where.scope === 'parcel') {
      // Report the heading, or for a loose file its name with the parcel number masked, so repeats group together.
      const label = where.heading ?? where.fileName.replace(/\d+/g, '#')
      unknownHeadings.set(label, (unknownHeadings.get(label) ?? 0) + 1)
    }
    items.push({
      full,
      parts,
      size: stat.size,
      ext,
      minuteBase,
      scope: where.scope,
      category,
      subFolder: where.subFolder,
      fileName: where.fileName,
      originalPath: parts.join('/'),
      ...describeFile(where.fileName, category),
      sha: await sha256(full),
    })
  }

  // 2) distinct contents, and a numbering for photos so their titles differ
  const unique = new Map()
  for (const item of items) if (!unique.has(item.sha)) unique.set(item.sha, item)
  const photoCount = new Map()
  items.forEach((item, index) => {
    item.sortOrder = index
    if (item.category === 'visits' && item.kind === 'image') {
      const key = `${item.minuteBase}`
      photoCount.set(key, (photoCount.get(key) ?? 0) + 1)
      item.title = `${item.title} ${photoCount.get(key)}`
    }
  })

  const totalBytes = items.reduce((sum, item) => sum + item.size, 0)
  const uniqueBytes = [...unique.values()].reduce((sum, item) => sum + item.size, 0)
  const byCategory = {}
  for (const item of items) byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
  const shared = [...unique.keys()].filter((sha) => new Set(items.filter((i) => i.sha === sha).map((i) => i.minuteBase)).size > 1).length

  console.log(`ملفات مقروءة: ${items.length} (${gb(totalBytes)})`)
  console.log(`محتوى فريد: ${unique.size} ملفًا (${gb(uniqueBytes)}) — توفير ${gb(totalBytes - uniqueBytes)} (${(((totalBytes - uniqueBytes) / totalBytes) * 100).toFixed(1)}%)`)
  console.log(`ملفات مشتركة بين أكثر من محضر: ${shared}`)
  console.log('بحسب القسم:', Object.entries(byCategory).map(([k, v]) => `${k} ${v}`).join(' · '))
  console.log(`ملفات على مستوى المنطقة: ${items.filter((i) => i.scope === 'region').length}`)
  if (unmatchedFolders.size) console.log('⚠ مجلدات لا يقابلها محضر في القاعدة (تُتخطى):', [...unmatchedFolders].map(([n, c]) => `${n} (${c})`).join(' · '))
  if (unknownHeadings.size) console.log('⚠ أقسام أو ملفات غير معروفة (تُحفظ كـ «أخرى»):', [...unknownHeadings].map(([n, c]) => `${n} (${c})`).join(' · '))

  // 3) what the database expects but has no file for
  const [annotationRows] = await connection.query(
    `SELECT DISTINCT a.ref_no FROM annotations a JOIN parcels p ON p.id = a.parcel_id JOIN regions r ON r.id = p.region_id
     WHERE r.name_ar = ? AND a.ref_no IS NOT NULL ORDER BY a.ref_no`,
    [region],
  )
  const filedAnnotations = new Set(items.map((i) => i.annotationRef).filter(Boolean))
  const missingAnnotations = annotationRows.map((r) => r.ref_no).filter((n) => !filedAnnotations.has(n))
  const withContract = new Set(items.filter((i) => i.category === 'contracts').map((i) => i.minuteBase))
  const withAny = new Set(items.map((i) => i.minuteBase))
  console.log(`\nإشارات في القاعدة بلا ملف (${missingAnnotations.length} من ${annotationRows.length}): ${missingAnnotations.join(', ') || '—'}`)
  console.log(`عقارات بلا أي ملف: ${[...parcelByBase.keys()].filter((b) => !withAny.has(b)).join(', ') || '—'}`)
  console.log(`عقارات بلا عقد شراء: ${[...parcelByBase.keys()].filter((b) => !withContract.has(b)).join(', ') || '—'}`)

  if (dryRun) {
    console.log('\n(تجربة فقط: لم يُنسخ ولم يُكتب شيء)')
    process.exit(0)
  }

  // 4) store the distinct files, then write the rows
  await connection.query(await fs.readFile(path.join(serverDir, 'sql/documents.sql'), 'utf8'))
  let copied = 0
  let copiedBytes = 0
  for (const item of unique.values()) {
    const dest = blobPath(item.sha)
    const stored = existsSync(dest) ? (await fs.stat(dest)).size : -1
    if (stored === item.size) continue
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(item.full, `${dest}.part`)
    await fs.rename(`${dest}.part`, dest)
    copied++
    copiedBytes += item.size
  }

  await connection.beginTransaction()
  const documentIds = new Map()
  for (const item of unique.values()) {
    const { mime, kind } = fileType(item.ext)
    const [result] = await connection.execute(
      `INSERT INTO documents (sha256, size_bytes, mime, ext, kind) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [item.sha, item.size, mime, item.ext.replace('.', ''), kind],
    )
    documentIds.set(item.sha, result.insertId)
  }
  for (const item of items) {
    await connection.execute(
      `INSERT INTO parcel_documents (region_name, minute_base, scope, document_id, category, title, original_name, original_path,
         doc_date, annotation_ref, group_label, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE minute_base = VALUES(minute_base), scope = VALUES(scope), document_id = VALUES(document_id),
         category = VALUES(category), title = VALUES(title), original_name = VALUES(original_name), doc_date = VALUES(doc_date),
         annotation_ref = VALUES(annotation_ref), group_label = VALUES(group_label), sort_order = VALUES(sort_order)`,
      [region, item.minuteBase, item.scope, documentIds.get(item.sha), item.category, item.title, item.fileName, item.originalPath,
        item.docDate, item.annotationRef, item.subFolder, item.sortOrder],
    )
  }
  await connection.commit()

  // 5) prove what is stored is what was read
  const [[links]] = await connection.query('SELECT COUNT(*) n FROM parcel_documents WHERE region_name = ?', [region])
  let missingOnDisk = 0
  for (const item of unique.values()) if (!existsSync(blobPath(item.sha))) missingOnDisk++
  console.log(`\nنُسخ ${copied} ملفًا جديدًا (${mb(copiedBytes)}) إلى ${storage}`)
  console.log(`${links.n === items.length ? '✓' : '✗'} روابط في القاعدة: ${links.n} · المقروء: ${items.length}`)
  console.log(`${missingOnDisk === 0 ? '✓' : '✗'} ملفات فريدة غير موجودة على القرص: ${missingOnDisk}`)
  if (links.n !== items.length || missingOnDisk) process.exitCode = 1
} catch (error) {
  await connection.rollback().catch(() => {})
  console.error(error.message)
  process.exitCode = 1
} finally {
  await connection.end()
}
