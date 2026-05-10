import { useMemo, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ConnectionInput, SshAuthMethod } from '@/data/types'
import { cn } from '@/lib/utils'
import { parseConnectionString, buildConnectionString } from '@/lib/connection-string'

const sslModeSchema = z.enum(['disable', 'prefer', 'require'])
const sshAuthMethodSchema = z.enum(['keyfile', 'password'])

const connectionSchema = z
  .object({
    name: z.string().min(2, 'Enter a connection name.'),
    host: z.string().min(1, 'Host is required.'),
    port: z.coerce.number().int().min(1).max(65535),
    database: z.string().min(1, 'Database is required.'),
    user: z.string().min(1, 'User is required.'),
    password: z.string().min(1, 'Password is required.'),
    sslMode: sslModeSchema,
    sshEnabled: z.boolean(),
    sshHost: z.string().optional(),
    sshPort: z.coerce.number().int().min(1).max(65535).optional(),
    sshUser: z.string().optional(),
    sshAuthMethod: sshAuthMethodSchema.optional(),
    sshPassword: z.string().optional(),
    sshPrivateKeyPath: z.string().optional(),
    sshPassphrase: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.sshEnabled) return
    if (!values.sshHost || values.sshHost.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SSH host is required.',
        path: ['sshHost'],
      })
    }
    if (!values.sshUser || values.sshUser.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SSH user is required.',
        path: ['sshUser'],
      })
    }
    if (values.sshAuthMethod === 'password') {
      if (!values.sshPassword || values.sshPassword.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SSH password is required.',
          path: ['sshPassword'],
        })
      }
    }
  })

type ConnectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ConnectionInput) => Promise<void> | void
  isPending?: boolean
}

function Field({
  label,
  error,
  inputId,
  children,
}: {
  label: string
  error?: string
  inputId: string
  children: ReactNode
}) {
  return (
    <label htmlFor={inputId} className="space-y-2 text-left text-xs text-muted-foreground">
      <span className="block">{label}</span>
      {children}
      {error ? <span className="block text-destructive">{error}</span> : null}
    </label>
  )
}

const selectClassName = cn(
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
)

type InputMode = 'string' | 'fields'

interface CustomParam {
  id: number
  key: string
  value: string
}

export function ConnectionDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: ConnectionDialogProps) {
  const defaultValues = useMemo(
    () => ({
      name: 'Local Postgres',
      host: '127.0.0.1',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: '',
      sslMode: 'prefer' as const,
      sshEnabled: false,
      sshHost: '',
      sshPort: 22,
      sshUser: '',
      sshAuthMethod: 'keyfile' as SshAuthMethod,
      sshPassword: '',
      sshPrivateKeyPath: '',
      sshPassphrase: '',
    }),
    [],
  )

  const form = useForm({
    resolver: zodResolver(connectionSchema),
    defaultValues,
  })

  const sshEnabled = useWatch({ control: form.control, name: 'sshEnabled' })
  const sshAuthMethod = useWatch({ control: form.control, name: 'sshAuthMethod' })

  const [inputMode, setInputMode] = useState<InputMode>('fields')
  const [connString, setConnString] = useState('')
  const [connStringError, setConnStringError] = useState<string | null>(null)

  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [advancedConnectTimeout, setAdvancedConnectTimeout] = useState('')
  const [advancedAppName, setAdvancedAppName] = useState('')
  const [advancedOptions, setAdvancedOptions] = useState('')
  const [advancedKeepalives, setAdvancedKeepalives] = useState(true)
  const [advancedKeepalivesIdle, setAdvancedKeepalivesIdle] = useState('')
  const [advancedSslRootCert, setAdvancedSslRootCert] = useState('')
  const [advancedSslCert, setAdvancedSslCert] = useState('')
  const [advancedSslKey, setAdvancedSslKey] = useState('')

  const [customParams, setCustomParams] = useState<CustomParam[]>([])
  const [nextCustomId, setNextCustomId] = useState(1)

  const handleConnStringChange = (value: string) => {
    setConnString(value)
    if (!value.trim()) {
      setConnStringError(null)
      return
    }
    const parsed = parseConnectionString(value)
    if (!parsed) {
      setConnStringError('Invalid connection string format.')
      return
    }
    setConnStringError(null)
    form.setValue('host', parsed.host)
    form.setValue('port', parsed.port)
    form.setValue('database', parsed.database)
    form.setValue('user', parsed.user)
    form.setValue('password', parsed.password)
    form.setValue('sslMode', parsed.sslMode)

    const extra = parsed.extraParams
    if (extra) {
      if ('connect_timeout' in extra) {
        setAdvancedConnectTimeout(extra['connect_timeout'])
        delete extra['connect_timeout']
      }
      if ('application_name' in extra) {
        setAdvancedAppName(extra['application_name'])
        delete extra['application_name']
      }
      if ('options' in extra) {
        setAdvancedOptions(extra['options'])
        delete extra['options']
      }
      if ('keepalives' in extra) {
        setAdvancedKeepalives(extra['keepalives'] !== '0')
        delete extra['keepalives']
      }
      if ('keepalives_idle' in extra) {
        setAdvancedKeepalivesIdle(extra['keepalives_idle'])
        delete extra['keepalives_idle']
      }
      if ('sslrootcert' in extra) {
        setAdvancedSslRootCert(extra['sslrootcert'])
        delete extra['sslrootcert']
      }
      if ('sslcert' in extra) {
        setAdvancedSslCert(extra['sslcert'])
        delete extra['sslcert']
      }
      if ('sslkey' in extra) {
        setAdvancedSslKey(extra['sslkey'])
        delete extra['sslkey']
      }

      const remaining = Object.entries(extra)
      if (remaining.length > 0) {
        setCustomParams(
          remaining.map(([key, value], i) => ({ id: i + 1, key, value })),
        )
        setNextCustomId(remaining.length + 1)
        setAdvancedOpen(true)
      }
    }

    const cs = buildConnectionString({
      ...parsed,
      sslMode: parsed.sslMode,
      extraParams: extra,
    })
    setConnString(cs)
  }

  const handleModeToggle = (mode: InputMode) => {
    if (mode === 'string') {
      const fields = form.getValues()
      const cs = buildConnectionString({
        user: fields.user || 'postgres',
        password: fields.password || '',
        host: fields.host || '127.0.0.1',
        port: Number(fields.port) || 5432,
        database: fields.database || 'postgres',
        sslMode: fields.sslMode || 'prefer',
        extraParams: collectExtraParams(),
      })
      setConnString(cs)
      setConnStringError(null)
    }
    setInputMode(mode)
  }

  const collectExtraParams = (): Record<string, string> => {
    const extra: Record<string, string> = {}
    if (advancedConnectTimeout) extra['connect_timeout'] = advancedConnectTimeout
    if (advancedAppName) extra['application_name'] = advancedAppName
    if (advancedOptions) extra['options'] = advancedOptions
    if (!advancedKeepalives) extra['keepalives'] = '0'
    if (advancedKeepalivesIdle) extra['keepalives_idle'] = advancedKeepalivesIdle
    if (advancedSslRootCert) extra['sslrootcert'] = advancedSslRootCert
    if (advancedSslCert) extra['sslcert'] = advancedSslCert
    if (advancedSslKey) extra['sslkey'] = advancedSslKey
    for (const p of customParams) {
      if (p.key.trim()) extra[p.key.trim()] = p.value
    }
    return extra
  }

  const handleSubmit = form.handleSubmit((values) => {
    const extraParams = collectExtraParams()
    const input: ConnectionInput = {
      name: values.name,
      host: values.host,
      port: values.port,
      database: values.database,
      user: values.user,
      password: values.password,
      sslMode: values.sslMode,
      extraParams: Object.keys(extraParams).length > 0 ? extraParams : null,
      sshConfig: values.sshEnabled
        ? {
            enabled: true,
            host: values.sshHost!,
            port: values.sshPort!,
            user: values.sshUser!,
            authMethod: values.sshAuthMethod!,
            password: values.sshPassword || null,
            privateKeyPath: values.sshPrivateKeyPath || null,
            passphrase: values.sshPassphrase || null,
          }
        : null,
    }
    void onSubmit(input)
  })

  const addCustomParam = () => {
    setCustomParams((prev) => [...prev, { id: nextCustomId, key: '', value: '' }])
    setNextCustomId((id) => id + 1)
  }

  const removeCustomParam = (id: number) => {
    setCustomParams((prev) => prev.filter((p) => p.id !== id))
  }

  const updateCustomParam = (id: number, field: 'key' | 'value', val: string) => {
    setCustomParams((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p)),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>New connection</DialogTitle>
          <DialogDescription>
            Credentials are sent straight to the Tauri backend and persisted there.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col max-h-[75vh]" onSubmit={handleSubmit}>
          <div className="overflow-y-auto space-y-5 px-6 py-4">
          <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => handleModeToggle('string')}
              className={cn(
                'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all',
                inputMode === 'string'
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Connection string
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle('fields')}
              className={cn(
                'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all',
                inputMode === 'fields'
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Individual fields
            </button>
          </div>

          {inputMode === 'string' && (
            <div className="space-y-2">
              <label
                htmlFor="veloxdb-connection-string"
                className="block text-xs text-muted-foreground"
              >
                Connection URI
              </label>
              <Input
                id="veloxdb-connection-string"
                value={connString}
                onChange={(e) => handleConnStringChange(e.target.value)}
                placeholder="postgresql://user:password@host:5432/dbname?sslmode=require"
                className={connStringError ? 'border-destructive' : ''}
              />
              {connStringError && (
                <span className="block text-xs text-destructive">{connStringError}</span>
              )}
              <p className="text-[11px] text-muted-foreground/80">
                Paste a full PostgreSQL connection URI. Individual fields will be populated
                automatically.
              </p>
            </div>
          )}

          <div className={cn('grid gap-4 sm:grid-cols-2', inputMode === 'string' && 'hidden')}>
            <Field
              label="Connection name"
              inputId="veloxdb-connection-name"
              error={form.formState.errors.name?.message}
            >
              <Input
                id="veloxdb-connection-name"
                {...form.register('name')}
                placeholder="VeloxDB local"
              />
            </Field>

            <Field
              label="Host"
              inputId="veloxdb-connection-host"
              error={form.formState.errors.host?.message}
            >
              <Input
                id="veloxdb-connection-host"
                {...form.register('host')}
                placeholder="127.0.0.1"
              />
            </Field>

            <Field
              label="Port"
              inputId="veloxdb-connection-port"
              error={form.formState.errors.port?.message}
            >
              <Input id="veloxdb-connection-port" {...form.register('port')} inputMode="numeric" />
            </Field>

            <Field
              label="Database"
              inputId="veloxdb-connection-database"
              error={form.formState.errors.database?.message}
            >
              <Input
                id="veloxdb-connection-database"
                {...form.register('database')}
                placeholder="postgres"
              />
            </Field>

            <Field
              label="User"
              inputId="veloxdb-connection-user"
              error={form.formState.errors.user?.message}
            >
              <Input id="veloxdb-connection-user" {...form.register('user')} placeholder="postgres" />
            </Field>

            <Field
              label="Password"
              inputId="veloxdb-connection-password"
              error={form.formState.errors.password?.message}
            >
              <Input id="veloxdb-connection-password" {...form.register('password')} type="password" />
            </Field>

            <Field
              label="SSL mode"
              inputId="veloxdb-connection-ssl-mode"
              error={form.formState.errors.sslMode?.message}
            >
              <select
                id="veloxdb-connection-ssl-mode"
                className={selectClassName}
                {...form.register('sslMode')}
              >
                <option value="disable">Disable (plain TCP)</option>
                <option value="prefer">Prefer (try TLS; local Postgres)</option>
                <option value="require">Require (Neon, hosted Postgres)</option>
              </select>
            </Field>
          </div>

          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground">
              <input
                type="checkbox"
                {...form.register('sshEnabled')}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Connect via SSH tunnel
            </label>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/70">
              Tunnel the database connection through a bastion/jump host. Key-based auth is
              recommended. Password auth requires{' '}
              <code className="rounded bg-muted px-1 py-px text-[11px]">sshpass</code> installed.
            </p>
          </div>

          {sshEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="SSH host"
                inputId="veloxdb-ssh-host"
                error={form.formState.errors.sshHost?.message}
              >
                <Input
                  id="veloxdb-ssh-host"
                  {...form.register('sshHost')}
                  placeholder="bastion.example.com"
                />
              </Field>

              <Field
                label="SSH port"
                inputId="veloxdb-ssh-port"
                error={form.formState.errors.sshPort?.message}
              >
                <Input
                  id="veloxdb-ssh-port"
                  {...form.register('sshPort')}
                  inputMode="numeric"
                  placeholder="22"
                />
              </Field>

              <Field
                label="SSH user"
                inputId="veloxdb-ssh-user"
                error={form.formState.errors.sshUser?.message}
              >
                <Input
                  id="veloxdb-ssh-user"
                  {...form.register('sshUser')}
                  placeholder="ubuntu"
                />
              </Field>

              <Field
                label="Auth method"
                inputId="veloxdb-ssh-auth-method"
                error={form.formState.errors.sshAuthMethod?.message}
              >
                <select
                  id="veloxdb-ssh-auth-method"
                  className={selectClassName}
                  {...form.register('sshAuthMethod')}
                >
                  <option value="keyfile">Key file (recommended)</option>
                  <option value="password">Password</option>
                </select>
              </Field>

              {sshAuthMethod === 'password' && (
                <Field
                  label="SSH password"
                  inputId="veloxdb-ssh-password"
                  error={form.formState.errors.sshPassword?.message}
                >
                  <Input
                    id="veloxdb-ssh-password"
                    {...form.register('sshPassword')}
                    type="password"
                    placeholder="SSH user password"
                  />
                </Field>
              )}

              {sshAuthMethod === 'keyfile' && (
                <>
                  <Field
                    label="Private key path"
                    inputId="veloxdb-ssh-key-path"
                    error={form.formState.errors.sshPrivateKeyPath?.message}
                  >
                    <Input
                      id="veloxdb-ssh-key-path"
                      {...form.register('sshPrivateKeyPath')}
                      placeholder="~/.ssh/id_rsa (optional)"
                    />
                  </Field>

                  <Field
                    label="Passphrase"
                    inputId="veloxdb-ssh-passphrase"
                    error={form.formState.errors.sshPassphrase?.message}
                  >
                    <Input
                      id="veloxdb-ssh-passphrase"
                      {...form.register('sshPassphrase')}
                      type="password"
                      placeholder="Key passphrase (optional)"
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn('shrink-0 transition-transform', advancedOpen && 'rotate-90')}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span>Advanced parameters</span>
            </button>
            <p className="mt-0.5 pl-6 text-[11px] text-muted-foreground/70">
              Additional PostgreSQL connection parameters (libpq-compatible). Optional.
            </p>

            {advancedOpen && (
              <div className="mt-4 space-y-4 pl-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="space-y-1.5 text-xs text-muted-foreground">
                    <span className="block">Connect timeout</span>
                    <Input
                      value={advancedConnectTimeout}
                      onChange={(e) => setAdvancedConnectTimeout(e.target.value)}
                      placeholder="12"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs text-muted-foreground">
                    <span className="block">Application name</span>
                    <Input
                      value={advancedAppName}
                      onChange={(e) => setAdvancedAppName(e.target.value)}
                      placeholder="VeloxDB"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs text-muted-foreground">
                    <span className="block">Keepalives idle</span>
                    <Input
                      value={advancedKeepalivesIdle}
                      onChange={(e) => setAdvancedKeepalivesIdle(e.target.value)}
                      placeholder="60"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs text-muted-foreground col-span-full sm:col-span-2">
                    <span className="block">Options</span>
                    <Input
                      value={advancedOptions}
                      onChange={(e) => setAdvancedOptions(e.target.value)}
                      placeholder="-c statement_timeout=30000"
                    />
                  </label>

                  <label className="flex items-center gap-2 pt-7 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={advancedKeepalives}
                      onChange={(e) => setAdvancedKeepalives(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Keepalives
                  </label>
                </div>

                <div className="border-t border-border/50 pt-4">
                  <span className="block text-xs text-muted-foreground mb-3">
                    TLS Certificates
                  </span>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-1.5 text-xs text-muted-foreground">
                      <span className="block">Root certificate</span>
                      <Input
                        value={advancedSslRootCert}
                        onChange={(e) => setAdvancedSslRootCert(e.target.value)}
                        placeholder="/path/to/ca.crt"
                      />
                    </label>

                    <label className="space-y-1.5 text-xs text-muted-foreground">
                      <span className="block">Client certificate</span>
                      <Input
                        value={advancedSslCert}
                        onChange={(e) => setAdvancedSslCert(e.target.value)}
                        placeholder="/path/to/client.crt"
                      />
                    </label>

                    <label className="space-y-1.5 text-xs text-muted-foreground">
                      <span className="block">Client key</span>
                      <Input
                        value={advancedSslKey}
                        onChange={(e) => setAdvancedSslKey(e.target.value)}
                        placeholder="/path/to/client.key"
                      />
                    </label>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">
                      Custom parameters
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addCustomParam}
                      className="h-auto px-2 py-0.5 text-xs"
                    >
                      + Add
                    </Button>
                  </div>
                  {customParams.length > 0 ? (
                    <div className="space-y-2">
                      {customParams.map((param) => (
                        <div key={param.id} className="flex gap-2">
                          <Input
                            value={param.key}
                            onChange={(e) => updateCustomParam(param.id, 'key', e.target.value)}
                            placeholder="param name"
                            className="flex-1"
                          />
                          <Input
                            value={param.value}
                            onChange={(e) => updateCustomParam(param.id, 'value', e.target.value)}
                            placeholder="value"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomParam(param.id)}
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 6 6 18" />
                              <path d="m6 6 12 12" />
                            </svg>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60">
                      No custom parameters. Add one to pass extra libpq options.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          </div>

          <DialogFooter className="border-t border-border px-6 py-4 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
