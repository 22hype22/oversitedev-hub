// Lightweight analytics stub. Replace with real implementation if needed.
export function track(_event: string, _props?: Record<string, unknown>, _path?: string): void {
  // no-op
}

export function startPresence(): () => void {
  return () => {};
}
