// @mostajs/orm-copy-data — SQL Dump Writer (destination = .sql file)
// Author: Dr Hamid MADANI drmdh@msn.com

import { writeFileSync } from 'node:fs'
import type { EntitySchema } from '@mostajs/orm'
import type { CopyStats } from '../types.js'

function escapeValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (v instanceof Date) return `'${v.toISOString()}'`
  const s = String(v).replace(/'/g, "''")
  return `'${s}'`
}

export function writeToSql(
  filePath: string,
  schemas: EntitySchema[],
  data: Map<string, Record<string, unknown>[]>,
  sourceLabel = 'unknown',
): CopyStats[] {
  const lines: string[] = [
    `-- @mostajs/orm-copy-data — SQL dump`,
    `-- Source : ${sourceLabel}`,
    `-- Date : ${new Date().toISOString()}`,
    `-- Entities : ${data.size}`,
    '',
  ]

  const stats: CopyStats[] = []

  for (const schema of schemas) {
    const rows = data.get(schema.name)
    if (!rows || rows.length === 0) {
      stats.push({ entity: schema.name, copied: 0, errors: 0, durationMs: 0 })
      continue
    }

    const start = Date.now()
    const tableName = schema.collection || schema.name

    lines.push(`-- Entity: ${schema.name} (${rows.length} rows)`)

    // Detect columns from the first row
    const columns = Object.keys(rows[0])
    const colList = columns.map(c => `"${c}"`).join(', ')

    // Batch INSERT (groups of 100 for readability)
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      const valuesList = batch.map(row => {
        const vals = columns.map(c => escapeValue(row[c]))
        return `  (${vals.join(', ')})`
      })
      lines.push(`INSERT INTO "${tableName}" (${colList}) VALUES`)
      lines.push(valuesList.join(',\n') + ';')
      lines.push('')
    }

    const ms = Date.now() - start
    stats.push({ entity: schema.name, copied: rows.length, errors: 0, durationMs: ms })
  }

  writeFileSync(filePath, lines.join('\n'), 'utf8')
  return stats
}
