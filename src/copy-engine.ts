// @mostajs/orm-copy-data — Copy Engine (1 source → N destinations)
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'
import type { SourceConfig, DestConfig, CopyOptions, CopyResult, CopyStats } from './types.js'
import { loadFromDb } from './loaders/db-loader.js'
import { loadFromJson } from './loaders/json-loader.js'
import { loadFromCsv } from './loaders/csv-loader.js'
import { loadFromSql } from './loaders/sql-loader.js'
import { writeToDb } from './writers/db-writer.js'
import { writeToSql } from './writers/sql-writer.js'
import { writeToJson } from './writers/json-writer.js'
import { writeToCsv } from './writers/csv-writer.js'

export async function copyData(params: {
  source: SourceConfig
  destinations: DestConfig[]
  schemas: EntitySchema[]
  options?: CopyOptions
}): Promise<CopyResult> {
  const { source, destinations, schemas, options } = params
  const log = options?.onLog ?? console.log
  const batchSize = options?.batchSize ?? 500
  const start = Date.now()

  // ── 1. Load data from source ──────────────────────────────────────
  log(`▶ Loading from ${source.type}${source.dialect ? ' (' + source.dialect + ')' : ''}...`)

  let data: Map<string, Record<string, unknown>[]>
  let disconnectSource: (() => Promise<void>) | null = null

  switch (source.type) {
    case 'db': {
      if (!source.dialect || !source.uri) throw new Error('DB source requires dialect + uri')
      const result = await loadFromDb({ dialect: source.dialect, uri: source.uri }, schemas, batchSize)
      data = result.data
      disconnectSource = result.disconnect
      break
    }
    case 'json': {
      if (!source.file) throw new Error('JSON source requires file path')
      data = loadFromJson(source.file)
      break
    }
    case 'csv': {
      if (!source.file) throw new Error('CSV source requires file or directory path')
      data = loadFromCsv(source.file)
      break
    }
    case 'sql': {
      if (!source.file) throw new Error('SQL source requires file path')
      data = loadFromSql(source.file)
      break
    }
    default:
      throw new Error(`Unknown source type: ${source.type}`)
  }

  // Filter entities if specified
  if (options?.entities?.length) {
    const keep = new Set(options.entities)
    for (const key of data.keys()) {
      if (!keep.has(key)) data.delete(key)
    }
  }

  let totalRows = 0
  for (const [name, rows] of data) {
    totalRows += rows.length
    log(`  ${name} : ${rows.length} rows`)
  }
  log(`  Total : ${totalRows} rows from ${data.size} entities`)

  // ── 2. Write to each destination ──────────────────────────────────
  const allStats: CopyStats[] = []
  const destLabels: string[] = []

  for (const dest of destinations) {
    const label = dest.type === 'db'
      ? `${dest.dialect} (${dest.uri?.slice(0, 40)}...)`
      : `${dest.type} (${dest.file})`
    destLabels.push(label)
    log(`\n▶ Writing to ${label}...`)

    let destStats: CopyStats[]

    switch (dest.type) {
      case 'db': {
        if (!dest.dialect || !dest.uri) throw new Error('DB dest requires dialect + uri')
        const result = await writeToDb(
          { dialect: dest.dialect, uri: dest.uri, createTables: dest.createTables ?? true },
          schemas, data, log,
        )
        destStats = result.stats
        await result.disconnect()
        break
      }
      case 'sql-dump': {
        if (!dest.file) throw new Error('SQL dump dest requires file path')
        const srcLabel = source.type === 'db' ? `${source.dialect}://${source.uri?.slice(0, 40)}` : source.file ?? ''
        destStats = writeToSql(dest.file, schemas, data, srcLabel)
        log(`  ✓ Written to ${dest.file}`)
        break
      }
      case 'json': {
        if (!dest.file) throw new Error('JSON dest requires file path')
        const srcLabel = source.type === 'db' ? `${source.dialect}://${source.uri?.slice(0, 40)}` : source.file ?? ''
        destStats = writeToJson(dest.file, data, srcLabel)
        log(`  ✓ Written to ${dest.file}`)
        break
      }
      case 'csv': {
        if (!dest.file) throw new Error('CSV dest requires directory path')
        destStats = writeToCsv(dest.file, data)
        log(`  ✓ Written to ${dest.file}/ (${data.size} files)`)
        break
      }
      default:
        throw new Error(`Unknown dest type: ${dest.type}`)
    }

    allStats.push(...destStats)
  }

  // ── 3. Cleanup ────────────────────────────────────────────────────
  if (disconnectSource) await disconnectSource()

  const durationMs = Date.now() - start
  const totalCopied = allStats.reduce((a, s) => a + s.copied, 0)
  const totalErrors = allStats.reduce((a, s) => a + s.errors, 0)

  log(`\n✓ Done : ${totalCopied} records → ${destinations.length} destination(s) in ${durationMs}ms (${totalErrors} errors)`)

  return {
    source: source.type === 'db' ? `${source.dialect}://${source.uri}` : source.file ?? source.type,
    destinations: destLabels,
    stats: allStats,
    totalCopied,
    totalErrors,
    durationMs,
  }
}
