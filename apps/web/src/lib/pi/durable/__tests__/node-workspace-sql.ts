import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import type { WorkspaceSql } from "../do-workspace-store"

type Binding = string | number | null

/** node:sqlite with the `ctx.storage.sql.exec(...).toArray()` shape. */
export function nodeWorkspaceSql(): WorkspaceSql {
  const dir = mkdtempSync(join(tmpdir(), "fleet-do-store-"))
  const db = new DatabaseSync(join(dir, "store.sqlite"))
  return {
    exec(query, ...bindings) {
      const statement = db.prepare(query)
      const values = bindings as Array<Binding>
      if (!query.trimStart().toUpperCase().startsWith("SELECT")) {
        statement.run(...values)
        return { toArray: () => [] }
      }
      const rows = statement.all(...values) as Array<Record<string, Binding>>
      return { toArray: () => rows }
    },
  }
}
