# Production backups and recovery (Neon)

Source of truth for the production database backup schedule, RPO and RTO.
Linked from [deployment-release-gate.md](./deployment-release-gate.md).

## Where the schedule lives

`@neon/config` 0.9.x (`neon.ts`) has no snapshot or backup schedule option,
so the schedule is set in the Neon console and is not declared in the repo.
Do not add a custom script for it. Revisit if `@neon/config` adds native
support.

Console path: Neon console → org **QredenceOS** → project **fleet-pi-pg18**
(`still-dream-77849440`) → Branches → `main` → Backup & restore → Snapshot
schedule.

## Current production settings

Verified read-only on 2026-10-16 with the Neon API (`get_snapshot_schedule`,
`describe_project`):

| Setting                      | Value                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Project                      | `still-dream-77849440` (fleet-pi-pg18, QredenceOS org, aws-us-east-2, PG 18) |
| Branch                       | `main` (`br-steep-credit-b4ajuym6`), protected                               |
| Snapshot frequency           | Daily at 03:00 UTC                                                           |
| Snapshot retention           | 35 days (`retention_seconds: 3024000`)                                       |
| Point-in-time restore window | 7 days (`history_retention_seconds: 604800`)                                 |

The legacy PG17 project `soft-art-21843403` (fleet-pi) has the same schedule
but is no longer production; see
[worker-postgres-connections.md](./worker-postgres-connections.md).

Re-check after any console change and update this table in the same PR.

## RPO

- **Within the last 7 days:** seconds. Point-in-time restore can target any
  LSN or timestamp in the history window.
- **8 to 35 days back:** up to 24 hours. Only daily 03:00 UTC snapshots exist.
- **Older than 35 days:** no recovery point.

Hosted chat transcripts live on the Durable Object (`UserPiDurable`), not in
Neon. The Neon `pi_*` projection is fail-open, so losing it does not lose the
transcript.

## RTO (estimate)

Estimate, not measured: **about 15 to 30 minutes** end to end.

- Branch restore / `restore_snapshot` is a copy-on-write metadata operation in
  Neon and usually completes in minutes for this database size (about 235 MB
  logical).
- The rest is operator time: pick the recovery point, restore, check the data,
  and confirm the Worker reconnects (connection strings for `main` do not
  change on an in-place restore).

## Restore procedure

1. Pick the target: a timestamp inside 7 days (PITR) or a snapshot.
2. Rehearse first: restore into a throwaway branch and check the data there.
3. Restore `main` (console: Backup & restore → Restore, or the Neon API
   restore endpoint). `main` is protected; this needs an owner and an approved
   production change.
4. Neon keeps the pre-restore state as a backup branch; keep it until the
   restore is confirmed, then delete it with approval.
5. Run `pnpm verify-deployment-readiness` and a smoke sign-in plus chat turn.
