// engine/zones.ts
// Zone resolution and pricing logic for zone_network mode

import {
  Airport,
  Zone,
  ZoneNetworkConfig,
  ZoneRepoRates,
  PeakPeriod,
} from "./quoteRequest"
import { NormalizedLeg, ZoneCalculationInfo } from "./quoteResult"
import { haversineNm, roundMoney, toYYYYMMDD } from "./utils"

/**
 * Find which zone an airport belongs to.
 * Returns null if airport is not in any zone.
 */
export function findZoneForAirport(
  airport: Airport,
  zones: Zone[]
): Zone | null {
  for (const zone of zones) {
    const match = zone.airports.find(
      (a) => a.icao.toUpperCase() === airport.icao.toUpperCase()
    )
    if (match) return zone
  }
  return null
}

/**
 * Find the closest airport within a specific zone to the given reference airport.
 */
export function findClosestAirportInZone(
  reference: Airport,
  zone: Zone
): Airport | null {
  if (zone.airports.length === 0) return null

  let closest: Airport | null = null
  let minDistance = Infinity

  for (const candidate of zone.airports) {
    const dist = haversineNm(
      reference.lat,
      reference.lon,
      candidate.lat,
      candidate.lon
    )
    if (dist < minDistance) {
      minDistance = dist
      closest = candidate
    }
  }

  return closest
}

/**
 * Select the zone and closest airport for a trip endpoint.
 * Used for zone_network mode to determine repo endpoints.
 * Returns null if no zone covers the trip endpoint.
 */
export function selectZoneForEndpoint(
  tripEndpoint: Airport,
  config: ZoneNetworkConfig
): { zone: Zone; airport: Airport } | null {
  // First check if the trip endpoint itself is directly in a zone
  const directZone = findZoneForAirport(tripEndpoint, config.zones)
  if (directZone) {
    return { zone: directZone, airport: tripEndpoint }
  }

  // Find the closest airport across all zones
  let bestMatch: { zone: Zone; airport: Airport; distance: number } | null =
    null

  for (const zone of config.zones) {
    for (const zoneAirport of zone.airports) {
      const dist = haversineNm(
        tripEndpoint.lat,
        tripEndpoint.lon,
        zoneAirport.lat,
        zoneAirport.lon
      )
      if (!bestMatch || dist < bestMatch.distance) {
        bestMatch = { zone, airport: zoneAirport, distance: dist }
      }
    }
  }

  return bestMatch ? { zone: bestMatch.zone, airport: bestMatch.airport } : null
}

/**
 * Get the repo rates for a zone.
 */
export function getZoneRepoRates(
  zoneId: string,
  config: ZoneNetworkConfig
): ZoneRepoRates | null {
  return config.zoneRepoRates.find((r) => r.zoneId === zoneId) ?? null
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
 * Get the peak multiplier for a zone and direction.
 * Returns 1.0 if no multiplier is defined.
 */
export function getPeakMultiplier(
  peak: PeakPeriod,
  zoneId: string,
  direction: "origin" | "destination"
): number {
  if (!peak.zoneMultipliers) return 1.0

  const zoneMultiplier = peak.zoneMultipliers.find((m) => m.zoneId === zoneId)
  if (!zoneMultiplier) return 1.0

  return direction === "origin"
    ? zoneMultiplier.originRepoMultiplier
    : zoneMultiplier.destinationRepoMultiplier
}

/**
 * Calculate zone-based repo cost for a single repo leg.
 * - Outbound repo (base → trip origin): uses zone's originRepoRate
 * - Inbound repo (trip dest → base): uses zone's destinationRepoRate
 */
export function calcZoneRepoCost(args: {
  leg: NormalizedLeg
  hours: number
  config: ZoneNetworkConfig
  departDateISO: string
  isOutbound: boolean
}): {
  cost: number
  zoneId: string | null
  zoneName: string | null
  baseRate: number
  appliedRate: number
  rateDirection: "origin" | "destination"
  peakPeriodId: string | null
  peakPeriodName: string | null
  peakMultiplier: number
} {
  const { leg, hours, config, departDateISO, isOutbound } = args

  // Determine which zone this leg is associated with
  // For outbound: the repo starts FROM a zone airport (origin rate)
  // For inbound: the repo ends AT a zone airport (destination rate)
  const relevantAirport = isOutbound ? leg.from : leg.to
  const zone = findZoneForAirport(relevantAirport, config.zones)
  const rateDirection = isOutbound ? "origin" : "destination"

  if (!zone) {
    // Should not happen if validation passes, but handle gracefully
    return {
      cost: 0,
      zoneId: null,
      zoneName: null,
      baseRate: 0,
      appliedRate: 0,
      rateDirection,
      peakPeriodId: null,
      peakPeriodName: null,
      peakMultiplier: 1.0,
    }
  }

  // Get base rate for this zone
  const zoneRates = getZoneRepoRates(zone.id, config)
  const baseRate = zoneRates
    ? isOutbound
      ? zoneRates.originRepoRate
      : zoneRates.destinationRepoRate
    : 0

  // Check for peak period
  const peak = findPeakPeriod(departDateISO, config.peakPeriods ?? [])
  let peakMultiplier = 1.0

  if (peak) {
    peakMultiplier = getPeakMultiplier(peak, zone.id, rateDirection)
  }

  const appliedRate = baseRate * peakMultiplier
  const cost = roundMoney(hours * appliedRate)

  return {
    cost,
    zoneId: zone.id,
    zoneName: zone.name,
    baseRate,
    appliedRate,
    rateDirection,
    peakPeriodId: peak?.id ?? null,
    peakPeriodName: peak?.name ?? null,
    peakMultiplier,
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
  occupiedRate: number
}): ZoneCalculationInfo {
  const {
    outboundZone,
    outboundAirport,
    inboundZone,
    inboundAirport,
    config,
    departDateISO,
    occupiedRate,
  } = args

  const peak = findPeakPeriod(departDateISO, config.peakPeriods ?? [])

  const info: ZoneCalculationInfo = {}

  if (outboundZone && outboundAirport) {
    const rates = getZoneRepoRates(outboundZone.id, config)
    const baseRate = rates?.originRepoRate ?? 0
    const multiplier = peak
      ? getPeakMultiplier(peak, outboundZone.id, "origin")
      : 1.0

    info.outboundZone = {
      zoneId: outboundZone.id,
      zoneName: outboundZone.name,
      selectedAirport: outboundAirport.icao,
      baseRate,
      appliedRate: baseRate * multiplier,
      rateDirection: "origin",
    }
  }

  if (inboundZone && inboundAirport) {
    const rates = getZoneRepoRates(inboundZone.id, config)
    const baseRate = rates?.destinationRepoRate ?? 0
    const multiplier = peak
      ? getPeakMultiplier(peak, inboundZone.id, "destination")
      : 1.0

    info.inboundZone = {
      zoneId: inboundZone.id,
      zoneName: inboundZone.name,
      selectedAirport: inboundAirport.icao,
      baseRate,
      appliedRate: baseRate * multiplier,
      rateDirection: "destination",
    }
  }

  // Occupied rate info
  const occupiedMultiplier = peak?.occupiedMultiplier ?? 1.0
  info.occupiedRate = {
    baseRate: occupiedRate,
    appliedRate: occupiedRate * occupiedMultiplier,
  }

  // Peak period info
  if (peak) {
    info.peakPeriod = {
      id: peak.id,
      name: peak.name,
      multipliers: {
        outboundRepo: outboundZone
          ? getPeakMultiplier(peak, outboundZone.id, "origin")
          : undefined,
        inboundRepo: inboundZone
          ? getPeakMultiplier(peak, inboundZone.id, "destination")
          : undefined,
        occupied: peak.occupiedMultiplier,
      },
    }
  }

  return info
}
