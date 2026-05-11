// @mostajs/orm-copy-data — types
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'

export type SourceType = 'db' | 'csv' | 'json' | 'sql'
export type DestType   = 'db' | 'csv' | 'json' | 'sql-dump'

export interface SourceConfig {
  type: SourceType
  dialect?: string
  uri?: string
  file?: string
  schemas?: EntitySchema[]
}

export interface DestConfig {
  type: DestType
  dialect?: string
  uri?: string
  file?: string
  createDb?: boolean
  createTables?: boolean
}

export interface CopyOptions {
  batchSize?: number
  entities?: string[]
  onProgress?: (entity: string, copied: number, total: number) => void
  onLog?: (msg: string) => void
}

export interface CopyStats {
  entity: string
  copied: number
  errors: number
  durationMs: number
}

export interface CopyResult {
  source: string
  destinations: string[]
  stats: CopyStats[]
  totalCopied: number
  totalErrors: number
  durationMs: number
}
