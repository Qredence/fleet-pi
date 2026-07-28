import { markDeployment } from "@/lib/db/pi-session-ownership-db"

/**
 * Example showing how to monitor PostgreSQL connection pool health
 * 
 * Use cases:
 * - Dashboard widget showing active/idle connections
 * - Alerting when pool exhaustion approaches
 * - Deployment health checks
 */

export function DatabaseHealthMonitor() {
  // Client-side polling (example using React Query or similar)
  // async function fetchPoolHealth() {
  //   const response = await fetch("/api/workspace/database-health")
  //   return response.json()
  // }
  
  // Usage pattern:
  // const { data, isLoading, error } = useQuery({
  //   queryKey: ["pool-health"],
  //   queryFn: fetchPoolHealth,
  //   refetchInterval: 30000, // Poll every 30 seconds
  // })
  //
  // if (isLoading) return <div>Loading...</div>
  // if (error) return <div>Error fetching health</div>
  //
  // return (
  //   <div className="p-4">
  //     <h3 className="text-lg font-semibold">Database Health</h3>
  //     <div className="grid grid-cols-2 gap-4 mt-4">
  //       <StatCard 
  //         label="Active Connections" 
  //         value={data.active.toString()} 
  //         trend={getTrend(data.active)}
  //       />
  //       <StatCard 
  //         label="Idle Connections" 
  //         value={data.idle.toString()}
  //         trend="stable"
  //       />
  //       <StatCard 
  //         label="Total Capacity" 
  //         value={data.total.toString()}
  //         trend="fixed"
  //       />
  //       <StatCard 
  //         label="Deploy Cycles" 
  //         value={data.deployedPools.toString()}
  //         trend={data.deployedPools > 1 ? "warning" : "ok"}
  //       />
  //     </div>
  //     
  //     {/* Warning if close to capacity */}
  //     {data.total > 0 && data.active / data.total > 0.8 && (
  //       <Alert variant="warning">
  //         Connection pool approaching capacity ({Math.round((data.active / data.total) * 100)}%)
  //       </Alert>
  //     )}
  //   </div>
  // )
}

/**
 * Call this on deployment/hot reload to track cleanup timing
 */
export function onDeploymentStart() {
  // Server-side: call in entry point or framework initialization
  markDeployment()
  
  // This ensures that old pool instances are eventually cleaned up
  // after new deployments complete their request handling window
}

// function getTrend(activeConnections: number): "increasing" | "decreasing" | "stable" {
//   // In real implementation, compare against historical data
//   // For now, use simple heuristics
//   if (activeConnections === 0) return "stable"
//   if (activeConnections > 3) return "increasing"
//   return "decreasing"
// }
