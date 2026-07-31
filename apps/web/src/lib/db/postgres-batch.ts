import type { PostgresQueryClient } from "./pi-session-ownership-db"

export type { PostgresQueryClient } from "./pi-session-ownership-db"

/**
 * Column descriptor for a chunked multi-row INSERT.
 * - `cast` appends a Postgres type cast to that column's placeholder
 *   (e.g. `{ name: "raw_entry", cast: "jsonb" }` renders `$17::jsonb`).
 * - `expression` renders inline SQL instead of a placeholder and binds no
 *   value (e.g. `{ name: "synced_at", expression: "now()" }`).
 */
export type InsertRowsColumn =
  string | { name: string; cast?: string; expression?: string }

export type InsertRowsChunkedOptions<TRow> = {
  table: string
  columns: Array<InsertRowsColumn>
  rows: Array<TRow>
  serializeRow: (row: TRow) => Array<unknown>
  onConflictSql?: string
  chunkSize?: number
}

const DEFAULT_CHUNK_SIZE = 50

function normalizeColumn(column: InsertRowsColumn) {
  return typeof column === "string" ? { name: column } : column
}

/**
 * Chunked multi-row INSERT engine. Owns chunking, positional `$N`
 * placeholder generation (with per-column casts such as `$17::jsonb`),
 * flat value arrays, and per-chunk `client.query` calls.
 *
 * `serializeRow` returns the bound values for one row in column order,
 * skipping any `expression` columns (which render inline SQL instead).
 */
export async function insertRowsChunked<TRow>(
  client: PostgresQueryClient,
  options: InsertRowsChunkedOptions<TRow>
): Promise<void> {
  const {
    table,
    columns,
    rows,
    serializeRow,
    onConflictSql,
    chunkSize = DEFAULT_CHUNK_SIZE,
  } = options

  if (rows.length === 0) return

  const normalized = columns.map(normalizeColumn)
  const columnList = normalized.map((column) => column.name).join(", ")

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const values: Array<unknown> = []
    const rowPlaceholders = chunk.map((row) => {
      const rowValues = serializeRow(row)
      let valueIndex = 0
      const placeholders = normalized.map((column) => {
        if (column.expression !== undefined) return column.expression
        values.push(rowValues[valueIndex++])
        const cast = column.cast ? `::${column.cast}` : ""
        return `$${values.length}${cast}`
      })
      return `(${placeholders.join(",")})`
    })
    const sql = `INSERT INTO ${table} (${columnList}) VALUES ${rowPlaceholders.join(",")}${onConflictSql ? ` ${onConflictSql}` : ""}`
    await client.query(sql, values)
  }
}
