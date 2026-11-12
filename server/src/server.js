import { createApp } from './app.js'
import { createPool, dbConfig } from './db.js'

const port = Number(process.env.PORT ?? 8000)
// Locally the app listens on this machine only. On a hosting panel (Plesk / Passenger) HOST is left unset and
// the panel decides the address.
const host = process.env.HOST
const pool = createPool()

try {
  await pool.query('SELECT 1')
} catch (error) {
  console.error(`تعذّر الاتصال بقاعدة البيانات ${dbConfig.database} على ${dbConfig.host}:${dbConfig.port} — ${error.message}`)
  process.exit(1)
}

const onListening = () => console.log(`API: /api/v1/health  (قاعدة البيانات: ${dbConfig.database})`)
const app = createApp(pool)
if (host) app.listen(port, host, onListening)
else app.listen(port, onListening)
