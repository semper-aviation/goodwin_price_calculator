// engine/pricing.ts
import { PricingKnobs } from "./quoteRequest"
import { Result, ok, err } from "./types"
import { LineItem, NormalizedLeg } from "./quoteResult"
import { roundMoney, reject } from "./utils"
import { calcZoneRepoCost, findPeakPeriod } from "./zones"

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

  // Check for peak period to apply to occupied rate
  const peak = findPeakPeriod(departDateISO, zoneConfig.peakPeriods ?? [])
  const occupiedMultiplier = peak?.occupiedMultiplier ?? 1.0
  const appliedOccupiedRate = p.occupiedRate * occupiedMultiplier
  const baseOccupied = roundMoney(occupiedHours * appliedOccupiedRate)

  // Calculate zone-based repo costs for each repo leg
  let baseRepo = 0
  const repoLineItems: LineItem[] = []
  const enrichedRepoLegs: NormalizedLeg[] = []

  for (let i = 0; i < repoLegs.length; i++) {
    const leg = repoLegs[i]
    if (leg.kind !== "REPO") {
      enrichedRepoLegs.push(leg)
      continue
    }

    const hours = leg.meta?.adjustedHours ?? 0
    // First repo leg is outbound, last repo leg (if different) is inbound
    const isOutbound = i === 0

    const result = calcZoneRepoCost({
      leg,
      hours,
      config: zoneConfig,
      departDateISO,
      isOutbound,
    })

    baseRepo += result.cost

    // Enrich the leg with zone metadata
    const enrichedLeg: NormalizedLeg = {
      ...leg,
      meta: {
        ...leg.meta,
        zoneId: result.zoneId ?? undefined,
        zoneName: result.zoneName ?? undefined,
        appliedRate: result.appliedRate,
        rateDirection: result.rateDirection,
        peakPeriodName: result.peakPeriodName ?? undefined,
        peakMultiplier: result.peakMultiplier !== 1.0 ? result.peakMultiplier : undefined,
      },
    }
    enrichedRepoLegs.push(enrichedLeg)

    // Create detailed line item
    const direction = isOutbound ? "outbound" : "inbound"
    repoLineItems.push({
      code: "BASE_REPO_ZONE",
      label: `Repo: ${result.zoneName ?? "Unknown"} (${direction})`,
      amount: result.cost,
      meta: {
        zoneName: result.zoneName,
        zoneId: result.zoneId,
        direction: result.rateDirection,
        hours,
        baseRate: result.baseRate,
        appliedRate: result.appliedRate,
        peakPeriod: result.peakPeriodName,
        peakMultiplier: result.peakMultiplier,
        fromIcao: leg.from.icao,
        toIcao: leg.to.icao,
      },
    })
  }

  return ok({
    baseOccupied,
    baseRepo: roundMoney(baseRepo),
    repoLineItems,
    enrichedRepoLegs,
  })
}
