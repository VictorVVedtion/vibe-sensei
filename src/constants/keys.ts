// GrowthBook feature flag client key.
// Set VIBE_SENSEI_GROWTHBOOK_KEY in your environment to enable feature flags.
export function getGrowthBookClientKey(): string {
  return process.env.VIBE_SENSEI_GROWTHBOOK_KEY ?? ''
}
