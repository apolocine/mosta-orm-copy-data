#!/usr/bin/env node
// @mostajs/orm-copy-data — CLI
// Author: Dr Hamid MADANI drmdh@msn.com
//
// Interactive :  npx @mostajs/orm-copy-data
// Non-interactive (cron) :
//   mostajs-copy --source db --source-dialect postgres --source-uri "..." \
//     --dest db --dest-dialect sqlite --dest-uri ./backup.sqlite \
//     --dest sql-dump --dest-file ./backup.sql \
//     --dest json --dest-file ./backup.json \
//     --dest csv --dest-file ./export/ \
//     --schemas entities.json --create-tables --batch-size 500

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'

// Support --commandFile : load all args from a file (one flag per line)
let argv = process.argv.slice(2)
const cmdFileIdx = argv.indexOf('--commandFile')
if (cmdFileIdx >= 0 && argv[cmdFileIdx + 1]) {
  const cmdFile = argv[cmdFileIdx + 1]
  if (existsSync(cmdFile)) {
    const lines = readFileSync(cmdFile, 'utf8')
      .split('\n')
      .map(l => l.replace(/#.*$/, '').trim())  // strip comments
      .filter(l => l.length > 0)
    // Parse each line as args (handles "value with spaces")
    const fileArgs = []
    for (const line of lines) {
      const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || []
      fileArgs.push(...parts.map(p => p.replace(/^"|"$/g, '')))
    }
    // Merge : commandFile args first, then any extra CLI args (except --commandFile itself)
    const extraArgs = [...argv.slice(0, cmdFileIdx), ...argv.slice(cmdFileIdx + 2)]
    argv = [...fileArgs, ...extraArgs]
    console.log(`✓ Loaded ${lines.length} lines from ${cmdFile}`)
  } else {
    console.error(`✗ Command file not found: ${cmdFile}`)
    process.exit(1)
  }
}
const has  = (f) => argv.includes('--' + f)
const val  = (f, d) => { const i = argv.indexOf('--' + f); return i >= 0 ? argv[i + 1] : d }
const vals = (f) => { const r = []; let i = 0; while (i < argv.length) { if (argv[i] === '--' + f && argv[i+1]) { r.push(argv[i+1]); i += 2 } else i++ } return r }

if (has('help') || has('h')) {
  console.log(`
  @mostajs/orm-copy-data — Cross-dialect data copy

  Usage :
    mostajs-copy                                        Interactive mode
    mostajs-copy --source db --source-dialect postgres   Non-interactive (cron)

  Source flags :
    --source          db | csv | json | sql
    --source-dialect  sqlite | postgres | mongodb | ...
    --source-uri      connection URI
    --source-file     file path (csv/json/sql)

  Destination flags (repeatable for multiple destinations) :
    --dest            db | csv | json | sql-dump
    --dest-dialect    dialect for db destinations
    --dest-uri        connection URI for db destinations
    --dest-file       file path for file destinations

  Options :
    --schemas         path to entities.json
    --create-tables   create tables on db destinations (default true)
    --batch-size      rows per read batch (default 500)
    --entities        comma-separated entity names to copy (default all)
  `)
  process.exit(0)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q, d) => new Promise(r => rl.question(`${q}${d ? ` [${d}]` : ''}: `, a => r(a.trim() || d || '')))

async function main() {
  const { copyData } = await import(resolve(import.meta.dirname, '..', 'dist', 'index.js'))

  let source, destinations = [], schemas = []

  // Load schemas
  let schemasPath = val('schemas', null)
  if (!schemasPath) {
    const defaults = ['.mostajs/generated/entities.json', 'entities.json']
    schemasPath = defaults.find(p => existsSync(p))
  }
  if (schemasPath && existsSync(schemasPath)) {
    schemas = JSON.parse(readFileSync(schemasPath, 'utf8'))
    console.log(`✓ Loaded ${schemas.length} schemas from ${schemasPath}`)
  }

  // Non-interactive mode
  if (val('source', null)) {
    const srcType = val('source', 'db')
    source = {
      type: srcType,
      dialect: val('source-dialect', undefined),
      uri: val('source-uri', undefined),
      file: val('source-file', undefined),
    }

    const destTypes = vals('dest')
    const destDialects = vals('dest-dialect')
    const destUris = vals('dest-uri')
    const destFiles = vals('dest-file')

    let di = 0, fi = 0
    for (const dt of destTypes) {
      if (dt === 'db') {
        destinations.push({ type: 'db', dialect: destDialects[di] || 'sqlite', uri: destUris[di] || './copy.sqlite', createTables: true })
        di++
      } else {
        destinations.push({ type: dt, file: destFiles[fi] || `./${dt}-output` })
        fi++
      }
    }
  } else {
    // Interactive mode
    console.log('\n▶ @mostajs/orm-copy-data — Interactive\n')

    console.log('  Source type :')
    console.log('    1) Database    2) CSV file    3) JSON file    4) SQL dump')
    const srcChoice = await ask('  Choice', '1')
    const srcTypes = { '1': 'db', '2': 'csv', '3': 'json', '4': 'sql' }
    const srcType = srcTypes[srcChoice] || 'db'

    source = { type: srcType }
    if (srcType === 'db') {
      source.dialect = await ask('  Source dialect (sqlite/postgres/mongodb/mysql/oracle/mssql)', 'sqlite')
      source.uri = await ask('  Source URI', './data.sqlite')
    } else {
      source.file = await ask('  Source file path', `./${srcType === 'csv' ? 'import/' : 'data.' + srcType}`)
    }

    console.log('\n  Destinations (enter one per line, empty to finish) :')
    while (true) {
      console.log('    1) Database    2) SQL dump    3) JSON file    4) CSV files    5) Done')
      const dc = await ask('  Choice', '5')
      if (dc === '5' || !dc) break
      const destTypes = { '1': 'db', '2': 'sql-dump', '3': 'json', '4': 'csv' }
      const dt = destTypes[dc] || 'db'
      if (dt === 'db') {
        const dialect = await ask('    Dialect', 'sqlite')
        const uri = await ask('    URI', './copy.sqlite')
        destinations.push({ type: 'db', dialect, uri, createTables: true })
      } else {
        const file = await ask('    File path', `./${dt === 'csv' ? 'export/' : 'backup.' + (dt === 'sql-dump' ? 'sql' : 'json')}`)
        destinations.push({ type: dt, file })
      }
    }
  }

  if (destinations.length === 0) {
    console.log('No destinations configured. Exiting.')
    rl.close()
    process.exit(0)
  }

  const batchSize = Number(val('batch-size', '500'))
  const entities = val('entities', '')?.split(',').filter(Boolean) || undefined

  const result = await copyData({
    source,
    destinations,
    schemas,
    options: { batchSize, entities: entities?.length ? entities : undefined },
  })

  rl.close()
  process.exit(result.totalErrors > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
