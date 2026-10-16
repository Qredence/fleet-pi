import type { PostgresQueryClient } from "../pi-session-mirror"
import type {
  SessionEntryBase,
  SessionHeader,
} from "@earendil-works/pi-coding-agent"

// Shared fixtures for the pi-session-mirror*.test.ts suites.
export type RecordedQuery = {
  sql: string
  params: Array<unknown>
}

export function createMockClient(): PostgresQueryClient & {
  queries: Array<RecordedQuery>
} {
  const queries: Array<RecordedQuery> = []
  return {
    queries,
    query(sql, params = []) {
      queries.push({ sql, params })
      if (sql.includes('AS "nextTurnIndex"')) {
        return Promise.resolve({ rows: [{ nextTurnIndex: 3 }] as Array<never> })
      }
      return Promise.resolve({ rows: [] as Array<never> })
    },
  }
}

export const header: SessionHeader = {
  type: "session",
  version: 3,
  id: "session-1",
  timestamp: "2026-05-22T10:00:00.000Z",
  cwd: "/repo",
}

export function entryBase(type: string, id: string): SessionEntryBase {
  return {
    type,
    id,
    parentId: null,
    timestamp: "2026-05-22T10:01:00.000Z",
  }
}
