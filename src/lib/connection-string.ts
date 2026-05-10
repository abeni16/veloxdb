import type { ConnectionSslMode } from '@/data/types'

export type ParsedConnectionString = {
  host: string
  port: number
  database: string
  user: string
  password: string
  sslMode: ConnectionSslMode
  extraParams: Record<string, string>
}

const DEFAULT_PG_PORT = 5432
const SSL_MODE_KEY = 'sslmode'

const VALID_SSL_MODES: Set<string> = new Set(['disable', 'prefer', 'require'])

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) {
    return trimmed
  }
  return `postgresql://${trimmed}`
}

/**
 * Parses a PostgreSQL connection URI like:
 *   postgresql://user:password@host:5432/dbname?sslmode=require&connect_timeout=10
 *
 * Falls back gracefully — unknown/unsupported params go into extraParams.
 */
export function parseConnectionString(raw: string): ParsedConnectionString | null {
  let url: URL
  try {
    url = new URL(normalizeUrl(raw))
  } catch {
    return null
  }

  const host = decodeURIComponent(url.hostname || '127.0.0.1')
  const port = url.port ? Number(url.port) : DEFAULT_PG_PORT
  const database = decodeURIComponent(url.pathname.replace(/^\//, '') || 'postgres')
  const user = decodeURIComponent(url.username || 'postgres')
  const password = decodeURIComponent(url.password || '')

  const params = new URLSearchParams(url.search)
  let sslMode: ConnectionSslMode = 'prefer'

  if (params.has(SSL_MODE_KEY)) {
    const rawMode = params.get(SSL_MODE_KEY)!.toLowerCase()
    if (VALID_SSL_MODES.has(rawMode)) {
      sslMode = rawMode as ConnectionSslMode
    }
    params.delete(SSL_MODE_KEY)
  }

  const extraParams: Record<string, string> = {}
  params.forEach((value, key) => {
    extraParams[key] = value
  })

  return { host, port, database, user, password, sslMode, extraParams }
}

/**
 * Builds a PostgreSQL connection URI from individual fields.
 */
export function buildConnectionString(fields: {
  user: string
  password: string
  host: string
  port: number
  database: string
  sslMode: ConnectionSslMode
  extraParams?: Record<string, string>
}): string {
  const encodedUser = encodeURIComponent(fields.user)
  const encodedPassword = fields.password ? `:${encodeURIComponent(fields.password)}` : ''
  const encodedHost = fields.host.includes(':') ? `[${fields.host}]` : fields.host

  let uri = `postgresql://${encodedUser}${encodedPassword}@${encodedHost}:${fields.port}/${encodeURIComponent(fields.database)}`

  const params = new URLSearchParams()
  if (fields.sslMode !== 'prefer') {
    params.set('sslmode', fields.sslMode)
  }
  if (fields.extraParams) {
    for (const [key, value] of Object.entries(fields.extraParams)) {
      params.set(key, value)
    }
  }

  const qs = params.toString()
  if (qs) uri += `?${qs}`

  return uri
}
