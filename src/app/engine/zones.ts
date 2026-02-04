// engine/zones.ts
// Zone resolution and time calculation logic for zone_network mode

import {
  Airport,
  Zone,
  ZoneNetworkConfig,
  ZoneRepoTimes,
  PeakPeriod,
} from "./quoteRequest"
import { NormalizedLeg, ZoneCalculationInfo } from "./quoteResult"

/**
 * Find which zone an airport belongs to based on its state.
 * Returns null if airport's state is not in any zone.
 */
export function findZoneForAirport(
  airport: Airport,
  zones: Zone[]
): Zone | null {
  if (!airport.state) return null

  const airportState = airport.state.toUpperCase()
  for (const zone of zones) {
    const match = zone.states.some(
      (s) => s.toUpperCase() === airportState
    )
    if (match) return zone
  }
  return null
}

/**
 * Check if an airport's state is covered by any zone.
 */
export function isAirportStateCovered(
  airport: Airport,
  zones: Zone[]
): boolean {
  return findZoneForAirport(airport, zones) !== null
}

/**
 * Select the zone for a trip endpoint based on the airport's state.
 * Used for zone_network mode to determine which zone applies.
 * Returns null if the airport's state is not covered by any zone.
 */
export function selectZoneForEndpoint(
  tripEndpoint: Airport,
  config: ZoneNetworkConfig
): { zone: Zone; airport: Airport } | null {
  // Find zone by airport's state
  const zone = findZoneForAirport(tripEndpoint, config.zones)
  if (zone) {
    return { zone, airport: tripEndpoint }
  }
  return null
}

/**
 * Get the repo times for a zone.
 */
export function getZoneRepoTimes(
  zoneId: string,
  config: ZoneNetworkConfig
): ZoneRepoTimes | null {
  return config.zoneRepoTimes.find((r) => r.zoneId === zoneId) ?? null
}

/**
 * Check if a date falls within a peak period.
 * Returns the first matching peak period or null.
 */
export function findPeakPeriod(
  dateISO: string,
  peakPeriods: PeakPeriod[]
): PeakPeriod | null {
  const dateYYYYMMDD = dateISO.slice(0, 10) // Extract YYYY-MM-DD

  for (const peak of peakPeriods) {
    if (dateYYYYMMDD >= peak.startDate && dateYYYYMMDD <= peak.endDate) {
      return peak
    }
  }
  return null
}

/**
 * Get the peak time override for a zone and direction.
 * Returns null if no override is defined (use base zone time).
 */
export function getPeakTimeOverride(
  peak: PeakPeriod,
  zoneId: string,
  direction: "origin" | "destination"
): number | null {
  if (!peak.zoneTimeOverrides) return null

  const zoneOverride = peak.zoneTimeOverrides.find((m) => m.zoneId === zoneId)
  if (!zoneOverride) return null

  const time = direction === "origin"
    ? zoneOverride.originRepoTime
    : zoneOverride.destinationRepoTime

  // Return null if time is 0 or undefined (meaning use base time)
  return time != null && time > 0 ? time : null
}

/**
 * Calculate zone repo time for a single repo leg.
 * Returns the zone repo time to add to the flight time.
 *
 * - Outbound repo (base → trip origin): uses zone's originRepoTime
 * - Inbound repo (trip dest → base): uses zone's destinationRepoTime
 *
 * Peak periods can override these times with specific values.
 */
export function calcZoneRepoTime(args: {
  leg: NormalizedLeg
  config: ZoneNetworkConfig
  departDateISO: string
  isOutbound: boolean
}): {
  zoneRepoTime: number
  zoneId: string | null
  zoneName: string | null
  baseRepoTime: number
  repoDirection: "origin" | "destination"
  peakPeriodId: string | null
  peakPeriodName: string | null
  isPeakOverride: boolean
} {
  const { leg, config, departDateISO, isOutbound } = args

  // Determine which zone this leg is associated with
  // For outbound: the repo starts FROM a zone airport (origin time)
  // For inbound: the repo ends AT a zone airport (destination time)
  const relevantAirport = isOutbound ? leg.from : leg.to
  const zone = findZoneForAirport(relevantAirport, config.zones)
  const repoDirection = isOutbound ? "origin" : "destination"

  if (!zone) {
    // Should not happen if validation passes, but handle gracefully
    return {
      zoneRepoTime: 0,
      zoneId: null,
      zoneName: null,
      baseRepoTime: 0,
      repoDirection,
      peakPeriodId: null,
      peakPeriodName: null,
      isPeakOverride: false,
    }
  }

  // Get base repo time for this zone
  const zoneTimes = getZoneRepoTimes(zone.id, config)
  const baseRepoTime = zoneTimes
    ? isOutbound
      ? zoneTimes.originRepoTime
      : zoneTimes.destinationRepoTime
    : 0

  // Check for peak period override
  const peak = findPeakPeriod(departDateISO, config.peakPeriods ?? [])
  let zoneRepoTime = baseRepoTime
  let isPeakOverride = false

  if (peak) {
    const peakOverride = getPeakTimeOverride(peak, zone.id, repoDirection)
    if (peakOverride !== null) {
      zoneRepoTime = peakOverride
      isPeakOverride = true
    }
  }

  return {
    zoneRepoTime,
    zoneId: zone.id,
    zoneName: zone.name,
    baseRepoTime,
    repoDirection,
    peakPeriodId: peak?.id ?? null,
    peakPeriodName: peak?.name ?? null,
    isPeakOverride,
  }
}

/**
 * Build zone calculation info for the quote result.
 */
export function buildZoneCalculationInfo(args: {
  outboundZone?: Zone
  outboundAirport?: Airport
  inboundZone?: Zone
  inboundAirport?: Airport
  config: ZoneNetworkConfig
  departDateISO: string
  repoRate: number
  occupiedRate: number
}): ZoneCalculationInfo {
  const {
    outboundZone,
    outboundAirport,
    inboundZone,
    inboundAirport,
    config,
    departDateISO,
    repoRate,
    occupiedRate,
  } = args

  const peak = findPeakPeriod(departDateISO, config.peakPeriods ?? [])

  const info: ZoneCalculationInfo = {}

  if (outboundZone && outboundAirport) {
    const times = getZoneRepoTimes(outboundZone.id, config)
    const baseRepoTime = times?.originRepoTime ?? 0
    const peakOverride = peak
      ? getPeakTimeOverride(peak, outboundZone.id, "origin")
      : null
    const appliedRepoTime = peakOverride !== null ? peakOverride : baseRepoTime

    info.outboundZone = {
      zoneId: outboundZone.id,
      zoneName: outboundZone.name,
      selectedAirport: outboundAirport.icao,
      baseRepoTime,
      appliedRepoTime,
      repoDirection: "origin",
    }
  }

  if (inboundZone && inboundAirport) {
    const times = getZoneRepoTimes(inboundZone.id, config)
    const baseRepoTime = times?.destinationRepoTime ?? 0
    const peakOverride = peak
      ? getPeakTimeOverride(peak, inboundZone.id, "destination")
      : null
    const appliedRepoTime = peakOverride !== null ? peakOverride : baseRepoTime

    info.inboundZone = {
      zoneId: inboundZone.id,
      zoneName: inboundZone.name,
      selectedAirport: inboundAirport.icao,
      baseRepoTime,
      appliedRepoTime,
      repoDirection: "destination",
    }
  }

  // Repo rate info (with peak multiplier)
  const repoRateMultiplier = peak?.repoRateMultiplier ?? 1.0
  info.repoRate = {
    baseRate: repoRate,
    appliedRate: repoRate * repoRateMultiplier,
  }

  // Occupied rate info (with peak multiplier)
  const occupiedMultiplier = peak?.occupiedMultiplier ?? 1.0
  info.occupiedRate = {
    baseRate: occupiedRate,
    appliedRate: occupiedRate * occupiedMultiplier,
  }

  // Peak period info
  if (peak) {
    const outboundTimeOverride = outboundZone
      ? getPeakTimeOverride(peak, outboundZone.id, "origin")
      : null
    const inboundTimeOverride = inboundZone
      ? getPeakTimeOverride(peak, inboundZone.id, "destination")
      : null

    info.peakPeriod = {
      id: peak.id,
      name: peak.name,
      timeOverrides: {
        outboundRepoTime: outboundTimeOverride ?? undefined,
        inboundRepoTime: inboundTimeOverride ?? undefined,
      },
      multipliers: {
        repoRate: peak.repoRateMultiplier,
        occupied: peak.occupiedMultiplier,
      },
    }
  }

  return info
}
