export function parseGoals(value: string): string[] {
  return value
    .split(/[,\n]+/)
    .map((goal) => goal.trim())
    .filter(Boolean);
}
