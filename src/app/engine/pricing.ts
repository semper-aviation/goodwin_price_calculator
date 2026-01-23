// engine/pricing.ts
import { PricingKnobs } from "./quoteRequest"
import { Result, ok, err, LineItem } from "./types"
import { roundMoney, reject } from "./utils"

export function calcBaseCost(
  knobs: PricingKnobs,
  occupiedHours: number,
  repoHours: number
): Result<{ baseOccupied: number; baseRepo: number }> {
  const p = knobs.pricing

  if (p.rateModel === "single_hourly") {
    if (typeof p.hourlyRate !== "number" || p.hourlyRate <= 0) {
      return err(
        reject(
          "MISSING_RATE",
          "hourlyRate required when pricing.rateModel=single_hourly",
          "pricing.hourlyRate"
        )
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
          "pricing.repoRate"
        )
      )
    }
    if (typeof p.occupiedRate !== "number" || p.occupiedRate <= 0) {
      return err(
        reject(
          "MISSING_RATE",
          "occupiedRate required when pricing.rateModel=dual_rate_repo_occupied",
          "pricing.occupiedRate"
        )
      )
    }
    return ok({
      baseOccupied: roundMoney(occupiedHours * p.occupiedRate),
      baseRepo: roundMoney(repoHours * p.repoRate),
    })
  }

  const _exhaustive: never = p.rateModel
  return err(
    reject(
      "INVALID_RATE_MODEL",
      `Unsupported rateModel ${_exhaustive}`,
      "pricing.rateModel"
    )
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
