import { DatabaseSync } from "node:sqlite"

import type { WorkspaceSql } from "../do-workspace-store"

type Binding = string | number | null

/** node:sqlite with the `ctx.storage.sql.exec(...).toArray()` shape. */
export function nodeWorkspaceSql(): WorkspaceSql {
  // In-memory: nothing is left behind in the OS temp folder.
  const db = new DatabaseSync(":memory:")
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
