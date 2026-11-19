// Serves the indexed documents (see documents/ingest.js): a parcel's list, and the files themselves.
//
// The documents are contracts and annotations with names in them, so they are off unless the site is protected:
// set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD (the whole site then asks for them), or DOCS_OPEN=1 for local work.
import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const docsDir = () => path.resolve(serverDir, process.env.DOCS_DIR ?? '../storage/documents')
export const blobPath = (sha) => path.join(docsDir(), 'blobs', sha.slice(0, 2), sha)

export function documentsEnabled(env = process.env) {
  return env.DOCS_OPEN === '1' || Boolean(env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD)
}

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest()

/** HTTP Basic authentication for the whole site (the health check stays open for monitoring). */
export function basicAuth(user, password) {
  const expectedUser = digest(user)
  const expectedPassword = digest(password)
  return (req, res, next) => {
    if (req.path === '/api/v1/health') return next()
    const [scheme, encoded] = (req.headers.authorization ?? '').split(' ')
    if (scheme?.toLowerCase() === 'basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8')
      const split = decoded.indexOf(':')
      const givenUser = split >= 0 ? decoded.slice(0, split) : decoded
      const givenPassword = split >= 0 ? decoded.slice(split + 1) : ''
      const ok = crypto.timingSafeEqual(digest(givenUser), expectedUser) && crypto.timingSafeEqual(digest(givenPassword), expectedPassword)
      if (ok) return next()
    }
    res.set('WWW-Authenticate', 'Basic realm="Sankari Investment", charset="UTF-8"')
    res.status(401).send('تسجيل الدخول مطلوب')
  }
}

const ORDER = `FIELD(pd.category, 'contracts', 'records', 'surveys', 'annotations', 'visits', 'other')`

export function registerDocumentRoutes(router, rows) {
  const one = async (sql, params = []) => (await rows(sql, params))[0]

  // A parcel's documents. Without the tables (nothing ingested yet) it is an empty list, not an error.
  router.get('/parcels/:id/documents', async (req, res) => {
    if (!documentsEnabled()) return res.json({ data: { enabled: false, available: true, items: [] } })
    const parcel = await one(
      'SELECT r.name_ar region, p.minute_base FROM parcels p JOIN regions r ON r.id = p.region_id WHERE p.id = ?',
      [Number(req.params.id)],
    )
    if (!parcel) return res.status(404).json({ message: 'العقار غير موجود.' })
    try {
      const items = await rows(
        `SELECT pd.id, pd.category, pd.title, pd.original_name, pd.doc_date, pd.annotation_ref, pd.group_label,
                d.size_bytes, d.mime, d.kind,
                (SELECT COUNT(DISTINCT x.region_name, x.minute_base) FROM parcel_documents x WHERE x.document_id = pd.document_id AND x.scope = 'parcel') shared_with
         FROM parcel_documents pd JOIN documents d ON d.id = pd.document_id
         WHERE pd.region_name = ? AND pd.minute_base = ? ORDER BY ${ORDER}, pd.sort_order`,
        [parcel.region, parcel.minute_base],
      )
      res.json({ data: { enabled: true, available: true, items } })
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') throw error
      res.json({ data: { enabled: true, available: false, items: [] } })
    }
  })

  // The file: shown in the browser (PDF, images) or downloaded (sheets, ?download=1). Range requests work, so a
  // large PDF opens at once.
  router.get('/documents/:linkId/file', async (req, res) => {
    if (!documentsEnabled()) return res.status(403).json({ message: 'عرض الوثائق معطّل: فعّل حماية الدخول (BASIC_AUTH_USER و BASIC_AUTH_PASSWORD).' })
    const id = Number(req.params.linkId)
    if (!Number.isInteger(id) || id < 1) return res.status(404).json({ message: 'الوثيقة غير موجودة.' })
    const doc = await one(
      `SELECT pd.original_name, d.sha256, d.mime, d.kind, d.ext FROM parcel_documents pd JOIN documents d ON d.id = pd.document_id WHERE pd.id = ?`,
      [id],
    )
    // The path comes only from the stored hash, never from the request.
    if (!doc || !/^[a-f0-9]{64}$/.test(doc.sha256)) return res.status(404).json({ message: 'الوثيقة غير موجودة.' })
    const file = blobPath(doc.sha256)
    if (!existsSync(file)) return res.status(404).json({ message: 'الملف غير موجود على الخادم.' })
    const asDownload = req.query.download === '1' || doc.kind === 'sheet' || doc.kind === 'other'
    res.set({
      'Content-Type': doc.mime,
      'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="document.${doc.ext}"; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    })
    res.sendFile(file, { dotfiles: 'allow' })
  })
}
