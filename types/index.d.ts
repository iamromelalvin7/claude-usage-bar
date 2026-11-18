export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = { model: string; limits: Limit[]; contextPercent?: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-bar': { snapshot: Snapshot | null }
  }
}
