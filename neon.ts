import { defineConfig } from "@neon/config/v1"

// Linked Neon project: fleet-pi-pg18. Readiness and chat:migrate probes for
// this repo must use that project's branch, not another Neon project.

export default defineConfig({
  // Managed Auth for identity; keep Data API off — Fleet Pi uses the
  // server path (JWKS-verified JWT + fleet_pi_app), not browser→REST.
  auth: true,
  dataApi: false,
  preview: {
    aiGateway: true,
    // Proof-only private bucket; see agent-workspace/scratch/tmp/neon-object-storage-spike.mjs
    buckets: {
      "fleet-pi-spike": {},
    },
  },
  branch: (branch) => ({
    protected: branch.name === "main",
    ...(branch.name === "main"
      ? {}
      : {
          parent: "main",
          ttl: "7d",
        }),
  }),
})
