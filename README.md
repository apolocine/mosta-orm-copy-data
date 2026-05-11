# @mostajs/orm-copy-data

> **Cross-dialect data copy — 1 source → N destinations. Backup, migration, seeding. CLI + API. Cron-ready.**

[![npm version](https://img.shields.io/npm/v/@mostajs/orm-copy-data.svg)](https://www.npmjs.com/package/@mostajs/orm-copy-data)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

Copy data between **13 databases**, CSV, JSON, and SQL dump files with one command. No infrastructure needed — just `npm install`.

## Supported sources & destinations

| | Source (read) | Destination (write) |
|---|---|---|
| **Database** (13 dialects) | ✅ | ✅ |
| **SQL dump** (.sql) | ✅ parse INSERT | ✅ generate INSERT |
| **JSON** (.json) | ✅ | ✅ |
| **CSV** (.csv) | ✅ | ✅ (1 file per entity) |

**Databases** : SQLite · PostgreSQL · MySQL · MariaDB · MongoDB · Oracle · SQL Server · CockroachDB · DB2 · SAP HANA · HSQLDB · Spanner · Sybase

## Install

**Important** : install inside your project directory — do NOT use `npx @mostajs/orm-copy-data` alone, because the database drivers must be in local `node_modules/`.

```bash
cd my-project
npm install @mostajs/orm-copy-data

# + the driver(s) for your source AND destination dialects :
npm install better-sqlite3    # SQLite
npm install pg                # PostgreSQL
npm install mongoose          # MongoDB
npm install mysql2            # MySQL
npm install mariadb           # MariaDB
npm install oracledb          # Oracle
npm install mssql             # SQL Server
# install only what you need
```

Then run :
```bash
npx mostajs-copy              # interactive
# or
npx mostajs-copy --source ... # non-interactive (cron)
```

> **Why not `npx @mostajs/orm-copy-data` directly?**
> `npx` creates a temporary environment without your project's database drivers (`better-sqlite3`, `pg`, `mongoose`...). The ORM lazy-loads drivers at runtime — they must be in the local `node_modules/`. Always install first, then run with `npx mostajs-copy` (which uses the local install).

---

## How to use — CLI (interactive)

```bash
npx @mostajs/orm-copy-data
```

```
▶ @mostajs/orm-copy-data — Interactive

  Source type :
    1) Database    2) CSV file    3) JSON file    4) SQL dump
  Choice [1]: 1
  Source dialect : postgres
  Source URI : postgresql://user:pass@localhost:5432/prod

  Destinations (enter one per line, empty to finish) :
    1) Database    2) SQL dump    3) JSON file    4) CSV files    5) Done
  Choice: 1
    Dialect: sqlite
    URI: ./backup.sqlite
  Choice: 2
    File path: ./backup.sql
  Choice: 3
    File path: ./backup.json
  Choice: 4
    File path: ./export/
  Choice: 5

▶ Loading from db (postgres)...
  Tenant : 15 rows
  User : 342 rows
  Product : 1,205 rows
  Total : 4,823 rows from 12 entities

▶ Writing to sqlite (./backup.sqlite)...
  Tenant : 15 copied, 0 errors (12ms)
  User : 342 copied, 0 errors (89ms)
  ...

▶ Writing to sql-dump (./backup.sql)...
  ✓ Written to ./backup.sql

▶ Writing to json (./backup.json)...
  ✓ Written to ./backup.json

▶ Writing to csv (./export/)...
  ✓ Written to ./export/ (12 files)

✓ Done : 4,823 records → 4 destination(s) in 1,230ms (0 errors)
```

---

## How to use — CLI (non-interactive / cron)

### Database → Database

```bash
mostajs-copy \
  --source db --source-dialect postgres --source-uri "postgresql://user:pass@host:5432/prod" \
  --dest db --dest-dialect sqlite --dest-uri "./backup.sqlite" \
  --schemas .mostajs/generated/entities.json \
  --create-tables
```

### Database → SQL dump + JSON + CSV (multi-destination)

```bash
mostajs-copy \
  --source db --source-dialect postgres --source-uri "$PROD_URI" \
  --dest db --dest-dialect sqlite --dest-uri "./backups/$(date +%Y%m%d).sqlite" \
  --dest sql-dump --dest-file "./backups/$(date +%Y%m%d).sql" \
  --dest json --dest-file "./backups/$(date +%Y%m%d).json" \
  --dest csv --dest-file "./backups/csv-$(date +%Y%m%d)/" \
  --schemas entities.json --create-tables --batch-size 1000
```

### CSV → Database (import)

```bash
mostajs-copy \
  --source csv --source-file ./import/ \
  --dest db --dest-dialect postgres --dest-uri "$URI" \
  --schemas entities.json --create-tables
```

### JSON → Database (restore)

```bash
mostajs-copy \
  --source json --source-file ./backup.json \
  --dest db --dest-dialect postgres --dest-uri "$URI" \
  --schemas entities.json --create-tables
```

### SQL dump → Database (restore)

```bash
mostajs-copy \
  --source sql --source-file ./backup.sql \
  --dest db --dest-dialect sqlite --dest-uri ./restored.sqlite \
  --schemas entities.json --create-tables
```

### Filter specific entities

```bash
mostajs-copy \
  --source db --source-dialect postgres --source-uri "$URI" \
  --dest db --dest-dialect sqlite --dest-uri ./subset.sqlite \
  --schemas entities.json --create-tables \
  --entities User,Product,Order
```

---

## How to use — Command file (`--commandFile`)

Instead of passing all flags on the command line, put them in a file :

**`backup-daily.conf`** :
```bash
# Daily backup — Postgres → SQLite + SQL dump
# Run : mostajs-copy --commandFile backup-daily.conf

--source db
--source-dialect postgres
--source-uri "postgresql://user:pass@localhost:5432/prod"

--dest db
--dest-dialect sqlite
--dest-uri "./backups/daily.sqlite"

--dest sql-dump
--dest-file "./backups/daily.sql"

--dest json
--dest-file "./backups/daily.json"

--schemas .mostajs/generated/entities.json
--create-tables
--batch-size 1000
```

```bash
mostajs-copy --commandFile backup-daily.conf
```

**Syntax rules :**
- One flag per line
- Lines starting with `#` are comments
- Values with spaces must be quoted : `--source-uri "postgres://user:pass@host/db"`
- Extra CLI flags override/extend the file

**Cron example :**
```bash
# /etc/cron.d/mostajs-backup
0 2 * * * cd /app && npx mostajs-copy --commandFile backup-daily.conf >> /var/log/backup.log 2>&1
```

---

## How to use — API (programmatic)

### Basic copy

```typescript
import { copyData } from '@mostajs/orm-copy-data'
import { entities } from './.mostajs/generated/entities.js'

const result = await copyData({
  source: {
    type: 'db',
    dialect: 'postgres',
    uri: 'postgresql://user:pass@localhost:5432/prod',
  },
  destinations: [
    { type: 'db', dialect: 'sqlite', uri: './backup.sqlite', createTables: true },
    { type: 'sql-dump', file: './backup.sql' },
    { type: 'json', file: './backup.json' },
    { type: 'csv', file: './export/' },
  ],
  schemas: entities,
  options: { batchSize: 500 },
})

console.log(`${result.totalCopied} records → ${result.destinations.length} destinations in ${result.durationMs}ms`)
```

### Individual loaders & writers

```typescript
import { loadFromDb, loadFromCsv, loadFromJson, loadFromSql } from '@mostajs/orm-copy-data'
import { writeToDb, writeToSql, writeToJson, writeToCsv } from '@mostajs/orm-copy-data'

// Load from any source
const { data, disconnect } = await loadFromDb({ dialect: 'postgres', uri: '...' }, schemas)
// or : const data = loadFromJson('./backup.json')
// or : const data = loadFromCsv('./import/')
// or : const data = loadFromSql('./dump.sql')

// Write to any destination
await writeToDb({ dialect: 'sqlite', uri: './copy.sqlite', createTables: true }, schemas, data)
writeToSql('./backup.sql', schemas, data, 'postgres://...')
writeToJson('./backup.json', data, 'postgres://...')
writeToCsv('./export/', data)

await disconnect()
```

---

## Output formats

### SQL dump

```sql
-- @mostajs/orm-copy-data — SQL dump
-- Source : postgres://user@host/prod
-- Date : 2026-04-18T15:30:00Z
-- Entities : 12

-- Entity: User (342 rows)
INSERT INTO "User" ("id", "email", "name", "role", "createdAt") VALUES
  ('uuid-1', 'alice@acme.com', 'Alice Martin', 'ADMIN', '2026-01-01'),
  ('uuid-2', 'bob@acme.com', 'Bob Wilson', 'MANAGER', '2026-02-15');
```

### JSON

```json
{
  "source": "postgres://user@host/prod",
  "date": "2026-04-18T15:30:00Z",
  "entities": {
    "User": [
      { "id": "uuid-1", "email": "alice@acme.com", "name": "Alice Martin" },
      { "id": "uuid-2", "email": "bob@acme.com", "name": "Bob Wilson" }
    ],
    "Product": [
      { "id": "uuid-10", "sku": "MAC-PRO-16", "title": "MacBook Pro", "price": 2499 }
    ]
  }
}
```

### CSV (one file per entity)

```
export/
├── User.csv
├── Product.csv
├── Order.csv
└── ...
```

```csv
id,email,name,role,createdAt
uuid-1,alice@acme.com,Alice Martin,ADMIN,2026-01-01
uuid-2,bob@acme.com,Bob Wilson,MANAGER,2026-02-15
```

---

## CLI flags reference

| Flag | Description | Default |
|---|---|---|
| `--source` | Source type : `db` \| `csv` \| `json` \| `sql` | — (required) |
| `--source-dialect` | Source dialect (db only) | — |
| `--source-uri` | Source connection URI (db only) | — |
| `--source-file` | Source file path (csv/json/sql only) | — |
| `--dest` | Destination type : `db` \| `csv` \| `json` \| `sql-dump` (repeatable) | — |
| `--dest-dialect` | Destination dialect (db only) | `sqlite` |
| `--dest-uri` | Destination URI (db only) | `./copy.sqlite` |
| `--dest-file` | Destination file path (file types only) | — |
| `--schemas` | Path to `entities.json` | auto-detect `.mostajs/generated/entities.json` |
| `--create-tables` | Create tables on db destinations | `true` |
| `--batch-size` | Rows per read batch | `500` |
| `--entities` | Comma-separated entity names (filter) | all |
| `--commandFile` | Load flags from a file (1 flag per line, # comments) | — |
| `--help` | Show help | — |

---

## Use cases

| Use case | Command |
|---|---|
| **Daily backup** | `mostajs-copy --commandFile backup.conf` via cron |
| **Prisma → new DB** | Bootstrap option 5 uses this internally |
| **Dev seeding** | JSON → SQLite for local dev |
| **Export for analytics** | Postgres → CSV for BI tools |
| **Cross-dialect migration** | Oracle → PostgreSQL one-shot |
| **Disaster recovery** | SQL dump → new DB |
| **Data archiving** | Prod DB → compressed JSON/CSV |

---

## Ecosystem

Part of the [@mostajs](https://www.npmjs.com/org/mostajs) ecosystem :

| Package | Role |
|---|---|
| `@mostajs/orm` | Multi-dialect ORM (13 databases) |
| `@mostajs/orm-cli` | Interactive CLI (convert, init, seed, replicate, bootstrap) |
| `@mostajs/orm-bridge` | Prisma drop-in replacement |
| `@mostajs/replicator` | Continuous CQRS replication (master/slave, CDC) |
| `@mostajs/replica-monitor` | Live replication dashboard |
| **`@mostajs/orm-copy-data`** | **One-shot data copy & backup (this package)** |

---

## License

**AGPL-3.0-or-later** + commercial license available — contact `drmdh@msn.com`.

## Author

Dr Hamid MADANI — [drmdh@msn.com](mailto:drmdh@msn.com)
