// @mostajs/orm-copy-data — SQL Dump Loader (parse INSERT statements)
// Author: Dr Hamid MADANI drmdh@msn.com

import { readFileSync } from 'node:fs'

export function loadFromSql(filePath: string): Map<string, Record<string, unknown>[]> {
  const content = readFileSync(filePath, 'utf8')
  const data = new Map<string, Record<string, unknown>[]>()

  const insertRegex = /INSERT\s+INTO\s+["'`]?(\w+)["'`]?\s*\(([^)]+)\)\s*VALUES\s*/gi
  let match: RegExpExecArray | null

  while ((match = insertRegex.exec(content)) !== null) {
    const table = match[1]
    const columns = match[2].split(',').map(c => c.trim().replace(/["'`]/g, ''))

    const valuesStart = insertRegex.lastIndex
    const valuesSection = extractValuesSection(content, valuesStart)

    const rows = parseValuesTuples(valuesSection, columns)
    const existing = data.get(table) ?? []
    existing.push(...rows)
    data.set(table, existing)
  }

  return data
}

function extractValuesSection(content: string, start: number): string {
  let depth = 0
  let i = start
  let section = ''
  while (i < content.length) {
    const ch = content[i]
    if (ch === '(') depth++
    if (ch === ')') depth--
    section += ch
    if (depth === 0 && ch === ')') {
      const next = content[i + 1]
      if (next === ',') { i += 2; section += ','; continue }
      if (next === ';' || !next || next === '\n') break
    }
    i++
  }
  return section
}

function parseValuesTuples(section: string, columns: string[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  const tupleRegex = /\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = tupleRegex.exec(section)) !== null) {
    const values = splitValues(m[1])
    const row: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      let v: unknown = values[i]?.trim()
      if (typeof v === 'string') {
        if (v === 'NULL' || v === 'null') v = null
        else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/''/g, "'")
        else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v)
      }
      row[col] = v
    })
    rows.push(row)
  }
  return rows
}

function splitValues(tuple: string): string[] {
  const result: string[] = []
  let current = ''
  let inString = false
  for (let i = 0; i < tuple.length; i++) {
    const ch = tuple[i]
    if (ch === "'" && !inString) { inString = true; current += ch; continue }
    if (ch === "'" && inString) {
      if (tuple[i + 1] === "'") { current += "''"; i++; continue }
      inString = false; current += ch; continue
    }
    if (ch === ',' && !inString) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}
