import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Client } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'init.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    // Habilita SSL si estás fuera de Railway. Con ?sslmode=require también funciona.
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? true : undefined,
  })

  await client.connect()
  try {
    await client.query(sql)
    console.log('✅ Esquema inicial creado/actualizado.')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('Error inicializando la base:', e)
  process.exit(1)
})
