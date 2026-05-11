// @mostajs/orm-copy-data — JSON Loader
// Author: Dr Hamid MADANI drmdh@msn.com

import { readFileSync } from 'node:fs'

export function loadFromJson(
  filePath: string,
): Map<string, Record<string, unknown>[]> {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'))
  const data = new Map<string, Record<string, unknown>[]>()

  if (raw.entities && typeof raw.entities === 'object') {
    for (const [name, rows] of Object.entries(raw.entities)) {
      if (Array.isArray(rows)) data.set(name, rows as Record<string, unknown>[])
    }
  } else if (Array.isArray(raw)) {
    data.set('default', raw)
  }
  return data
}
