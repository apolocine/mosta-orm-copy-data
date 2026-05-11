// @mostajs/orm-copy-data — JSON Writer (destination = .json file)
// Author: Dr Hamid MADANI drmdh@msn.com

import { writeFileSync } from 'node:fs'
import type { CopyStats } from '../types.js'

export function writeToJson(
  filePath: string,
  data: Map<string, Record<string, unknown>[]>,
  sourceLabel = 'unknown',
): CopyStats[] {
  const output: Record<string, unknown> = {
    source: sourceLabel,
    date: new Date().toISOString(),
    entities: Object.fromEntries(data),
  }

  writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8')

  return Array.from(data.entries()).map(([name, rows]) => ({
    entity: name,
    copied: rows.length,
    errors: 0,
    durationMs: 0,
  }))
}
