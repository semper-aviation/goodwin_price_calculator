import { PricingKnobs } from "./quoteRequest"

/**
 * Migration function to update knobs from old schema to new schema
 *
 * Breaking Change (Feature 5): Round Trip Split Thresholds
 * - Move maxNightsBeforeSplit from fees.overnight to trip
 */
export function migrateKnobs(oldKnobs: any): PricingKnobs {
  const newKnobs = { ...oldKnobs }

  // Migration 1: Move maxNightsBeforeSplit from fees.overnight to trip
  if (oldKnobs.fees?.overnight?.maxNightsBeforeSplit !== undefined) {
    if (!newKnobs.trip) {
      newKnobs.trip = {}
    }
    newKnobs.trip.maxNightsBeforeSplit =
      oldKnobs.fees.overnight.maxNightsBeforeSplit
    delete newKnobs.fees.overnight.maxNightsBeforeSplit
  }

  return newKnobs as PricingKnobs
}
