// @mostajs/orm-copy-data — DB Writer (destination = any ORM dialect)
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'
import { createIsolatedDialect, registerSchemas } from '@mostajs/orm'
import type { CopyStats } from '../types.js'

export interface DbWriterConfig {
  dialect: string
  uri: string
  createTables?: boolean
}

export async function writeToDb(
  config: DbWriterConfig,
  schemas: EntitySchema[],
  data: Map<string, Record<string, unknown>[]>,
  onLog?: (msg: string) => void,
): Promise<{ stats: CopyStats[]; disconnect: () => Promise<void> }> {
  registerSchemas(schemas)
  const d = await createIsolatedDialect(
    { dialect: config.dialect, uri: config.uri, schemaStrategy: config.createTables ? 'update' : 'none' } as Parameters<typeof createIsolatedDialect>[0],
    schemas,
  )
  if (config.createTables) await d.initSchema(schemas)

  const stats: CopyStats[] = []

  for (const schema of schemas) {
    const rows = data.get(schema.name)
    if (!rows || rows.length === 0) {
      stats.push({ entity: schema.name, copied: 0, errors: 0, durationMs: 0 })
      continue
    }

    const start = Date.now()
    let copied = 0
    let errors = 0

    for (const row of rows) {
      try {
        const { createdAt, updatedAt, ...rest } = row
        await d.create(schema, rest)
        copied++
      } catch {
        errors++
      }
    }

    const ms = Date.now() - start
    stats.push({ entity: schema.name, copied, errors, durationMs: ms })
    onLog?.(`  ${schema.name} : ${copied} copied, ${errors} errors (${ms}ms)`)
  }

  return { stats, disconnect: () => d.disconnect() }
}
