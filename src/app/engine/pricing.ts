// engine/pricing.ts
import { PricingKnobs } from "./quoteRequest"
import { Result, ok, err } from "./types"
import { LineItem, NormalizedLeg } from "./quoteResult"
import { roundMoney, reject } from "./utils"
import { calcZoneRepoTime, findPeakPeriod } from "./zones"

export function calcBaseCost(
  knobs: PricingKnobs,
  occupiedHours: number,
  repoHours: number,
): Result<{ baseOccupied: number; baseRepo: number }> {
  const p = knobs.pricing

  if (p.rateModel === "single_hourly") {
    if (typeof p.hourlyRate !== "number" || p.hourlyRate <= 0) {
      return err(
        reject(
          "MISSING_RATE",
          "hourlyRate required when pricing.rateModel=single_hourly",
          "pricing.hourlyRate",
        ),
      )
    }
    return ok({
      baseOccupied: roundMoney(occupiedHours * p.hourlyRate),
      baseRepo: roundMoney(repoHours * p.hourlyRate),
    })
  }

  if (p.rateModel === "dual_rate_repo_occupied") {
    if (typeof p.repoRate !== "number" || p.repoRate <= 0) {
      return err(
        reject(
          "MISSING_RATE",
          "repoRate required when pricing.rateModel=dual_rate_repo_occupied",
          "pricing.repoRate",
        ),
      )
    }
    if (typeof p.occupiedRate !== "number" || p.occupiedRate <= 0) {
      return err(
        reject(
          "MISSING_RATE",
          "occupiedRate required when pricing.rateModel=dual_rate_repo_occupied",
          "pricing.occupiedRate",
        ),
      )
    }
    return ok({
      baseOccupied: roundMoney(occupiedHours * p.occupiedRate),
      baseRepo: roundMoney(repoHours * p.repoRate),
    })
  }

  if (p.rateModel === "zone_based") {
    // Zone-based pricing is handled separately in calcZoneBasedCost
    // This branch should not be reached if calcZoneBasedCost is used correctly
    return err(
      reject(
        "ZONE_PRICING_ERROR",
        "zone_based pricing requires calcZoneBasedCost function",
        "pricing.rateModel",
      ),
    )
  }

  const _exhaustive: never = p.rateModel
  return err(
    reject(
      "INVALID_RATE_MODEL",
      `Unsupported rateModel ${_exhaustive}`,
      "pricing.rateModel",
    ),
  )
}

/**
 * Feature 1: Price Floors & Ceilings
 * Applies minimum and maximum pricing constraints
 */
export function applyPriceConstraints(args: {
  knobs: PricingKnobs
  tentativeTotal: number
  occupiedLegCount: number
}): LineItem[] {
  const { knobs, tentativeTotal, occupiedLegCount } = args
  const constraints = knobs.fees.priceConstraints

  if (!constraints) return []

  const items: LineItem[] = []
  let currentTotal = tentativeTotal

  // 1. Per-leg minimum (applied proportionally)
  if (typeof constraints.minPricePerLeg === "number" && occupiedLegCount > 0) {
    const requiredMin = constraints.minPricePerLeg * occupiedLegCount
    if (currentTotal < requiredMin) {
      const adjustment = roundMoney(requiredMin - currentTotal)
      items.push({
        code: "FEE_MIN_PRICE_PER_LEG",
        label: `Min price adjustment (${occupiedLegCount} leg${
          occupiedLegCount > 1 ? "s" : ""
        })`,
        amount: adjustment,
        meta: {
          minPricePerLeg: constraints.minPricePerLeg,
          occupiedLegCount,
        },
      })
      currentTotal += adjustment
    }
  }

  // 2. Trip-level minimum
  if (typeof constraints.minTripPrice === "number") {
    if (currentTotal < constraints.minTripPrice) {
      const adjustment = roundMoney(constraints.minTripPrice - currentTotal)
      items.push({
        code: "FEE_MIN_TRIP_PRICE",
        label: "Min trip price adjustment",
        amount: adjustment,
        meta: { minTripPrice: constraints.minTripPrice },
      })
      currentTotal += adjustment
    }
  }

  // 3. Trip-level maximum (cap)
  if (typeof constraints.maxTripPrice === "number") {
    if (currentTotal > constraints.maxTripPrice) {
      const reduction = roundMoney(currentTotal - constraints.maxTripPrice)
      items.push({
        code: "DISCOUNT_MAX_TRIP_PRICE_CAP",
        label: "Max trip price cap",
        amount: -reduction,
        meta: { maxTripPrice: constraints.maxTripPrice },
      })
    }
  }

  return items
}

/**
 * Calculate zone-based pricing for zone_network mode.
 *
 * New model:
 * - Total time = flight time + zone origin time + zone destination time
 * - Occupied cost = occupied hours × occupied rate (with peak multiplier)
 * - Repo cost = (zone origin time + zone destination time) × repo rate (with peak multiplier)
 *
 * Returns base costs and detailed line items for each repo leg.
 */
export function calcZoneBasedCost(args: {
  knobs: PricingKnobs
  occupiedHours: number
  repoLegs: NormalizedLeg[]
  departDateISO: string
}): Result<{
  baseOccupied: number
  baseRepo: number
  totalZoneRepoTime: number
  repoLineItems: LineItem[]
  enrichedRepoLegs: NormalizedLeg[]
}> {
  const { knobs, occupiedHours, repoLegs, departDateISO } = args
  const p = knobs.pricing
  const zoneConfig = knobs.repo.zoneNetwork

  if (!zoneConfig) {
    return err(
      reject(
        "MISSING_ZONE_CONFIG",
        "zoneNetwork config required for zone_based pricing",
        "repo.zoneNetwork"
      )
    )
  }

  if (typeof p.occupiedRate !== "number" || p.occupiedRate <= 0) {
    return err(
      reject(
        "MISSING_RATE",
        "occupiedRate required for zone_based pricing",
        "pricing.occupiedRate"
      )
    )
  }

  if (typeof p.repoRate !== "number" || p.repoRate <= 0) {
    return err(
      reject(
        "MISSING_RATE",
        "repoRate required for zone_based pricing",
        "pricing.repoRate"
      )
    )
  }

  // Check for peak period to apply to rates
  const peak = findPeakPeriod(departDateISO, zoneConfig.peakPeriods ?? [])
  const occupiedMultiplier = peak?.occupiedMultiplier ?? 1.0
  const repoRateMultiplier = peak?.repoRateMultiplier ?? 1.0

  const appliedOccupiedRate = p.occupiedRate * occupiedMultiplier
  const appliedRepoRate = p.repoRate * repoRateMultiplier

  const baseOccupied = roundMoney(occupiedHours * appliedOccupiedRate)

  // Calculate zone repo times for each repo leg
  let totalZoneRepoTime = 0
  const repoLineItems: LineItem[] = []
  const enrichedRepoLegs: NormalizedLeg[] = []

  for (let i = 0; i < repoLegs.length; i++) {
    const leg = repoLegs[i]
    if (leg.kind !== "REPO") {
      enrichedRepoLegs.push(leg)
      continue
    }

    // First repo leg is outbound, last repo leg (if different) is inbound
    const isOutbound = i === 0

    const result = calcZoneRepoTime({
      leg,
      config: zoneConfig,
      departDateISO,
      isOutbound,
    })

    totalZoneRepoTime += result.zoneRepoTime

    // Enrich the leg with zone metadata
    const enrichedLeg: NormalizedLeg = {
      ...leg,
      meta: {
        ...leg.meta,
        zoneId: result.zoneId ?? undefined,
        zoneName: result.zoneName ?? undefined,
        zoneRepoTime: result.zoneRepoTime,
        repoDirection: result.repoDirection,
        peakPeriodName: result.peakPeriodName ?? undefined,
        isPeakOverride: result.isPeakOverride || undefined,
      },
    }
    enrichedRepoLegs.push(enrichedLeg)

    // Create detailed line item for this zone's repo time contribution
    const direction = isOutbound ? "outbound" : "inbound"
    const legCost = roundMoney(result.zoneRepoTime * appliedRepoRate)

    repoLineItems.push({
      code: "BASE_REPO_ZONE",
      label: `Zone repo time: ${result.zoneName ?? "Unknown"} (${direction})`,
      amount: legCost,
      meta: {
        zoneName: result.zoneName,
        zoneId: result.zoneId,
        direction: result.repoDirection,
        zoneRepoTime: result.zoneRepoTime,
        baseRepoTime: result.baseRepoTime,
        repoRate: p.repoRate,
        appliedRepoRate,
        peakPeriod: result.peakPeriodName,
        isPeakOverride: result.isPeakOverride,
        fromIcao: leg.from.icao,
        toIcao: leg.to.icao,
      },
    })
  }

  // Total repo cost = total zone repo time × applied repo rate
  const baseRepo = roundMoney(totalZoneRepoTime * appliedRepoRate)

  return ok({
    baseOccupied,
    baseRepo,
    totalZoneRepoTime,
    repoLineItems,
    enrichedRepoLegs,
  })
}
