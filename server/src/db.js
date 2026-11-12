import mysql from 'mysql2/promise'

export const dbConfig = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'realestate_insights',
}

export function createPool() {
  return mysql.createPool({
    ...dbConfig,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 8,
    // Money and areas come back as numbers, not strings.
    decimalNumbers: true,
    dateStrings: true,
  })
}
