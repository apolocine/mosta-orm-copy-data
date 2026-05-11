// @mostajs/orm-copy-data — CSV Loader
// Author: Dr Hamid MADANI drmdh@msn.com

import { readFileSync, readdirSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { statSync } from 'node:fs'

function parseCsv(content: string, separator = ','): Record<string, unknown>[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line, separator)
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      let v: unknown = values[i]?.trim().replace(/^"|"$/g, '')
      if (v === 'null' || v === '') v = null
      else if (v === 'true') v = true
      else if (v === 'false') v = false
      else if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) v = Number(v)
      row[h] = v
    })
    return row
  })
}

function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === sep && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

export function loadFromCsv(
  pathOrDir: string,
  separator = ',',
): Map<string, Record<string, unknown>[]> {
  const data = new Map<string, Record<string, unknown>[]>()
  const stat = statSync(pathOrDir)

  if (stat.isDirectory()) {
    const files = readdirSync(pathOrDir).filter(f => extname(f) === '.csv')
    for (const f of files) {
      const name = basename(f, '.csv')
      const content = readFileSync(join(pathOrDir, f), 'utf8')
      data.set(name, parseCsv(content, separator))
    }
  } else {
    const name = basename(pathOrDir, '.csv')
    const content = readFileSync(pathOrDir, 'utf8')
    data.set(name, parseCsv(content, separator))
  }
  return data
}
