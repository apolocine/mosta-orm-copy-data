// @mostajs/orm-copy-data — DB Loader (source = any ORM dialect)
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'
import { createIsolatedDialect, registerSchemas, BaseRepository } from '@mostajs/orm'

export interface DbLoaderConfig {
  dialect: string
  uri: string
}

export async function loadFromDb(
  config: DbLoaderConfig,
  schemas: EntitySchema[],
  batchSize = 500,
): Promise<{ data: Map<string, Record<string, unknown>[]>; disconnect: () => Promise<void> }> {
  registerSchemas(schemas)
  const d = await createIsolatedDialect(
    { dialect: config.dialect, uri: config.uri, schemaStrategy: 'none' } as Parameters<typeof createIsolatedDialect>[0],
    schemas,
  )

  const data = new Map<string, Record<string, unknown>[]>()

  for (const schema of schemas) {
    const repo = new BaseRepository(schema, d)
    const rows: Record<string, unknown>[] = []
    let offset = 0
    while (true) {
      const batch = await repo.findAll({}, { limit: batchSize, skip: offset, sort: { id: 1 } } as Record<string, unknown>)
      if (!batch || batch.length === 0) break
      rows.push(...(batch as Record<string, unknown>[]))
      if (batch.length < batchSize) break
      offset += batchSize
    }
    data.set(schema.name, rows)
  }

  return { data, disconnect: () => d.disconnect() }
}
