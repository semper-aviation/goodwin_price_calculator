// engine/pricing.ts
import { PricingKnobs } from "./quoteRequest"
import { Result, ok, err } from "./types"
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
