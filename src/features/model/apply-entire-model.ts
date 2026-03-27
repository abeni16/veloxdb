import { veloxDbRepository } from '@/data/repositories'
import type { TableInfo } from '@/data/types'
import type { TableKey } from '@/features/model/model-types'

export type ColumnOverride = {
  isNullable: boolean
  isUnique: boolean
}

export type TableIdentityDraft = {
  schema: string
  name: string
}

export type PendingModelColumn = {
  id: string
  columnName: string
  dataType: string
  nullable: boolean
  defaultSql?: string
}

export type PendingModelForeignKey = {
  id: string
  fromKey: TableKey
  fromColumn: string
  toKey: TableKey
  toColumn: string
  constraintName?: string
}

export function quotePgIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`
}

const PG_IDENT_MAX = 63

export function buildAddColumnStatement(
  table: Pick<TableInfo, 'schema' | 'name'>,
  col: PendingModelColumn,
): string {
  const name = col.columnName.trim()
  const dataType = col.dataType.trim()
  const tbl = `${quotePgIdent(table.schema)}.${quotePgIdent(table.name)}`
  let sql = `ALTER TABLE ${tbl} ADD COLUMN ${quotePgIdent(name)} ${dataType}`
  if (!col.nullable) sql += ' NOT NULL'
  const d = col.defaultSql?.trim()
  if (d) sql += ` DEFAULT ${d}`
  return sql
}

function defaultFkConstraintName(
  from: Pick<TableInfo, 'schema' | 'name'>,
  fromColumn: string,
  to: Pick<TableInfo, 'schema' | 'name'>,
  toColumn: string,
): string {
  const raw = `veloxdb_fk_${from.name}_${fromColumn}_${to.name}_${toColumn}`
  const safe = raw.replace(/[^a-zA-Z0-9_]/g, '_')
  return safe.slice(0, PG_IDENT_MAX)
}

export function buildAddForeignKeyStatement(
  from: Pick<TableInfo, 'schema' | 'name'>,
  fromColumn: string,
  to: Pick<TableInfo, 'schema' | 'name'>,
  toColumn: string,
  constraintName?: string,
): string {
  const cname = (constraintName?.trim() || defaultFkConstraintName(from, fromColumn, to, toColumn)).slice(
    0,
    PG_IDENT_MAX,
  )
  const fromRef = `${quotePgIdent(from.schema)}.${quotePgIdent(from.name)}`
  const toRef = `${quotePgIdent(to.schema)}.${quotePgIdent(to.name)}`
  return `ALTER TABLE ${fromRef} ADD CONSTRAINT ${quotePgIdent(cname)} FOREIGN KEY (${quotePgIdent(fromColumn)}) REFERENCES ${toRef} (${quotePgIdent(toColumn)})`
}

/** Build ALTER statements to move from current catalog identity to draft (PostgreSQL). */
export function buildTableRenameStatements(
  current: Pick<TableInfo, 'schema' | 'name'>,
  draft: TableIdentityDraft,
): string[] {
  const tbl = `${quotePgIdent(current.schema)}.${quotePgIdent(current.name)}`

  if (draft.schema === current.schema && draft.name === current.name) {
    return []
  }

  if (draft.schema === current.schema && draft.name !== current.name) {
    return [`ALTER TABLE ${tbl} RENAME TO ${quotePgIdent(draft.name)}`]
  }

  if (draft.schema !== current.schema && draft.name === current.name) {
    return [`ALTER TABLE ${tbl} SET SCHEMA ${quotePgIdent(draft.schema)}`]
  }

  return [
    `ALTER TABLE ${tbl} RENAME TO ${quotePgIdent(draft.name)}`,
    `ALTER TABLE ${quotePgIdent(current.schema)}.${quotePgIdent(draft.name)} SET SCHEMA ${quotePgIdent(draft.schema)}`,
  ]
}

export type ApplyEntireModelParams = {
  connectionId: string
  onCanvas: TableKey[]
  tablesByKey: Map<TableKey, TableInfo>
  identityDraftByKey: Record<TableKey, TableIdentityDraft>
  columnOverridesByKey: Record<TableKey, Record<string, ColumnOverride>>
  pendingAddColumnsByKey: Record<TableKey, PendingModelColumn[]>
  pendingForeignKeys: PendingModelForeignKey[]
}

export type ApplyEntireModelResult = {
  renamed: Array<{ from: TableKey; to: TableKey }>
}

/**
 * Applies new columns and FKs (catalog table names), then column constraint edits, then rename/schema DDL.
 */
export async function applyEntireModel({
  connectionId,
  onCanvas,
  tablesByKey,
  identityDraftByKey,
  columnOverridesByKey,
  pendingAddColumnsByKey,
  pendingForeignKeys,
}: ApplyEntireModelParams): Promise<ApplyEntireModelResult> {
  const renamed: Array<{ from: TableKey; to: TableKey }> = []

  const ddlPre: string[] = []
  for (const key of onCanvas) {
    const table = tablesByKey.get(key)
    if (!table) continue
    const adds = pendingAddColumnsByKey[key]
    if (!adds?.length) continue
    for (const col of adds) {
      if (!col.columnName.trim() || !col.dataType.trim()) continue
      ddlPre.push(buildAddColumnStatement(table, col))
    }
  }
  for (const fk of pendingForeignKeys) {
    if (fk.fromKey === fk.toKey) continue
    const fromT = tablesByKey.get(fk.fromKey)
    const toT = tablesByKey.get(fk.toKey)
    if (!fromT || !toT) continue
    if (!fk.fromColumn.trim() || !fk.toColumn.trim()) continue
    ddlPre.push(
      buildAddForeignKeyStatement(fromT, fk.fromColumn.trim(), toT, fk.toColumn.trim(), fk.constraintName),
    )
  }
  if (ddlPre.length > 0) {
    await veloxDbRepository.executeDdlTransaction({
      connectionId,
      statements: ddlPre,
    })
  }

  for (const key of onCanvas) {
    const table = tablesByKey.get(key)
    if (!table) continue

    const overrides = columnOverridesByKey[key]
    if (!overrides || Object.keys(overrides).length === 0) continue

    const props = await veloxDbRepository.getTableProperties(connectionId, table)
    let needsApply = false
    const columns = props.map((col) => {
      const o = overrides[col.columnName]
      const isNullable = o?.isNullable ?? col.isNullable
      const isUnique = o?.isUnique ?? col.isUnique
      if (isNullable !== col.isNullable || isUnique !== col.isUnique) {
        needsApply = true
      }
      return { columnName: col.columnName, isNullable, isUnique }
    })

    if (needsApply) {
      await veloxDbRepository.applyTableProperties({
        connectionId,
        tableSchema: table.schema,
        tableName: table.name,
        columns,
      })
    }
  }

  const renameStatements: string[] = []
  for (const key of onCanvas) {
    const table = tablesByKey.get(key)
    if (!table) continue
    const draft = identityDraftByKey[key] ?? { schema: table.schema, name: table.name }
    if (draft.schema === table.schema && draft.name === table.name) continue
    renameStatements.push(...buildTableRenameStatements(table, draft))
    renamed.push({ from: key, to: `${draft.schema}.${draft.name}` })
  }

  if (renameStatements.length > 0) {
    await veloxDbRepository.executeDdlTransaction({
      connectionId,
      statements: renameStatements,
    })
  }

  return { renamed }
}
