// @mostajs/orm-copy-data — CSV Writer (destination = dir with 1 file per entity)
// Author: Dr Hamid MADANI drmdh@msn.com

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CopyStats } from '../types.js'

function escapeCsvValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function writeToCsv(
  dirPath: string,
  data: Map<string, Record<string, unknown>[]>,
  separator = ',',
): CopyStats[] {
  mkdirSync(dirPath, { recursive: true })
  const stats: CopyStats[] = []

  for (const [name, rows] of data) {
    if (rows.length === 0) {
      stats.push({ entity: name, copied: 0, errors: 0, durationMs: 0 })
      continue
    }

    const start = Date.now()
    const columns = Object.keys(rows[0])
    const header = columns.join(separator)
    const lines = rows.map(row =>
      columns.map(c => escapeCsvValue(row[c])).join(separator)
    )

    const filePath = join(dirPath, `${name}.csv`)
    writeFileSync(filePath, [header, ...lines].join('\n') + '\n', 'utf8')

    const ms = Date.now() - start
    stats.push({ entity: name, copied: rows.length, errors: 0, durationMs: ms })
  }

  return stats
}
