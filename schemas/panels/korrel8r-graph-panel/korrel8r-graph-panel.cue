package model

kind: "Korrel8rGraphPanel"
spec: close({
  startQuery?: string
  mode?: "neighbors" | "goals"
  goals?: string
  datasourceName?: string
  // Omit depth for the Korrel8r default; 0 returns only the start results.
  depth?: int & >=0
  limit?: int & >=1
})
