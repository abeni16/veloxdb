import { save } from '@tauri-apps/plugin-dialog'
import { veloxDbRepository } from '@/data/repositories'
import type { ResultRow } from '@/features/queries/result-edits'

function toDisplay(value: string | null | undefined) {
  return value ?? ''
}

function csvEscape(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function buildCsvContent(columns: string[], rows: ResultRow[]) {
  const header = columns.map(csvEscape).join(',')
  const body = rows.map((row) =>
    columns.map((col) => csvEscape(toDisplay(row[col]))).join(','),
  )
  return [header, ...body].join('\n')
}

function buildJsonContent(columns: string[], rows: ResultRow[]) {
  return JSON.stringify(
    rows.map((row) => {
      const obj: Record<string, string | null> = {}
      for (const col of columns) {
        obj[col] = row[col] ?? null
      }
      return obj
    }),
    null,
    2,
  )
}

export async function copyRows(columns: string[], rows: ResultRow[]) {
  const header = columns.join('\t')
  const body = rows.map((row) =>
    columns.map((col) => toDisplay(row[col])).join('\t'),
  )
  await navigator.clipboard.writeText([header, ...body].join('\n'))
}

export async function downloadRowsAsCsv(
  filename: string,
  columns: string[],
  rows: ResultRow[],
) {
  const path = await save({
    defaultPath: filename,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (!path) return

  const content = buildCsvContent(columns, rows)
  await veloxDbRepository.saveTextFile(content, path)
}

export async function downloadRowsAsJson(
  filename: string,
  columns: string[],
  rows: ResultRow[],
) {
  const path = await save({
    defaultPath: filename,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!path) return

  const content = buildJsonContent(columns, rows)
  await veloxDbRepository.saveTextFile(content, path)
}
