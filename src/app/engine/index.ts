// engine/index.ts
import type { QuoteRequestPayload } from "./quoteRequest"
import type { LineItem, QuoteResult } from "./quoteResult"

import {
  buildOccupiedLegs,
  calcMatchScore,
  computeCalendarDaysTouched,
  computeOvernights,
  reject,
  sumAdjustedHours,
  sum,
} from "./utils"

import { summarizeTotals, sumTwoQuotes } from "./aggregation"
import { runEligibilityChecks, checkDailyHourLimits } from "./eligibility"
import {
  resolveVhbCandidates,
  buildRepoLegs,
  enforceRepoConstraints,
} from "./repo"
import { applyTimeAdjustmentsAndValidate } from "./time"
import { calcBaseCost, applyPriceConstraints, calcZoneBasedCost } from "./pricing"
import { buildZoneCalculationInfo } from "./zones"
import { calcFees } from "./fees"
import { calcVhbDiscount, calcTimeBasedDiscount } from "./discounts"
import { calcFlightSeconds } from "./flightTime"

export async function quoteEngine(
  payload: QuoteRequestPayload,
  logger?: (message: string) => void
): Promise<QuoteResult> {
  const now = new Date()
  if (logger) {
    logger("ℹ️   Engine: ========== PRICING RUN ==========")
    logger(`ℹ️   Engine: Trip type: ${payload.trip.tripType}`)
  }
  const basic = validateBasics(payload)
  if (basic) return basic

  if (payload.trip.tripType === "ROUND_TRIP" && payload.trip.returnLocalISO) {
    const overnights = computeOvernights(
      payload.trip.departLocalISO,
      payload.trip.returnLocalISO
    )
    // Feature 5: Trip splitting moved from fees.overnight to trip-level config
    const splitThreshold = payload.knobs.trip?.maxNightsBeforeSplit

    if (typeof splitThreshold === "number" && overnights > splitThreshold) {
      const outReq: QuoteRequestPayload = {
        trip: {
          ...payload.trip,
          tripType: "ONE_WAY",
          returnLocalISO: undefined,
          returnTimezone: undefined,
        },
        knobs: payload.knobs,
      }

      const backReq: QuoteRequestPayload = {
        trip: {
          ...payload.trip,
          tripType: "ONE_WAY",
          from: payload.trip.to,
          to: payload.trip.from,
          departLocalISO: payload.trip.returnLocalISO,
          departTimezone: payload.trip.returnTimezone,
          returnLocalISO: undefined,
          returnTimezone: undefined,
        },
        knobs: payload.knobs,
      }

      const out = await quoteOneItinerary(outReq, now, logger)
      if (out.status === "REJECTED") return out

      const back = await quoteOneItinerary(backReq, now, logger)
      if (back.status === "REJECTED") return back

      return sumTwoQuotes(out, back, {
        note: `Split RT into 2 one-ways because overnights (${overnights}) > ${splitThreshold}.`,
      })
    }
  }

  const result = await quoteOneItinerary(payload, now, logger)
  if (logger) {
    logger("ℹ️   Engine: ========== END PRICING RUN ==========")
  }
  return result
}

async function quoteOneItinerary(
  payload: QuoteRequestPayload,
  now: Date,
  logger?: (message: string) => void
): Promise<QuoteResult> {
  const { trip, knobs } = payload

  const occupiedLegs = buildOccupiedLegs(trip)
  const itineraryStart = trip.from
  const itineraryEnd = occupiedLegs[occupiedLegs.length - 1].to

  const eligibility = runEligibilityChecks(trip, knobs, now)
  if (eligibility) return eligibility

  // Only needed for vhb_network + for vhb discounts (if you want discounts to work on fixed_base too,
  // you can still compute it. Here we compute when either is relevant.)
  const needsVhbList =
    knobs.repo.mode === "vhb_network" ||
    (knobs.discounts.vhbDiscount != null &&
      knobs.discounts.vhbDiscount.mode !== "none")

  const vhbCandidates = needsVhbList
    ? await resolveVhbCandidates(trip.category, knobs)
    : []

  const repoR = buildRepoLegs({
    itineraryStart,
    itineraryEnd,
    knobs,
    vhbCandidates,
  })
  if (!repoR.ok) return repoR.error
  const repoBuild = repoR.value

  const allLegs = [...repoBuild.legsOut, ...occupiedLegs, ...repoBuild.legsBack]

  const actualSeconds = await calcFlightSeconds(
    allLegs,
    trip.category,
    trip,
    logger
  )

  const timeR = applyTimeAdjustmentsAndValidate({
    trip,
    knobs,
    legs: allLegs,
    actualSeconds,
  })
  if (!timeR.ok) return timeR.error
  const { legsWithTime, occupiedHours, repoHours, totalHours } = timeR.value
  if (logger) {
    const occupiedIdxs = legsWithTime
      .map((leg, index) => (leg.kind === "OCCUPIED" ? index : -1))
      .filter((index) => index >= 0)
    const firstOccupiedIdx = occupiedIdxs[0] ?? -1
    const lastOccupiedIdx =
      occupiedIdxs.length > 0 ? occupiedIdxs[occupiedIdxs.length - 1] : -1
    logger("ℹ️   Engine: ========== LEG TIME ADJUSTMENTS ==========")
    legsWithTime.forEach((leg, index) => {
      const actual = leg.meta?.actualHours ?? 0
      const adjusted = leg.meta?.adjustedHours ?? actual
      const adjustment = adjusted - actual
      const label = buildLegLabel(
        leg.kind,
        index,
        firstOccupiedIdx,
        lastOccupiedIdx,
        occupiedIdxs.length
      )
      logger(
        `ℹ️   Engine:   ${label}: ${leg.from.icao} → ${
          leg.to.icao
        } | Base: ${actual.toFixed(2)} hrs + Adjustment: ${adjustment.toFixed(
          2
        )} hrs = ${adjusted.toFixed(2)} hrs`
      )
    })
    logger(
      `ℹ️   Engine: Total base flight time (ALL legs): ${(
        occupiedHours + repoHours
      ).toFixed(2)} hrs (Repo: ${repoHours.toFixed(
        2
      )} hrs + Occupied: ${occupiedHours.toFixed(2)} hrs)`
    )
    logger(
      `ℹ️   Engine: Time Adjustment: ${(
        totalHours -
        (occupiedHours + repoHours)
      ).toFixed(2)} hrs`
    )
    logger(
      `ℹ️   Engine: Adjusted total flight time: ${totalHours.toFixed(2)} hrs`
    )
    logger("ℹ️   Engine: ========== END LEG TIME ADJUSTMENTS ==========")
  }

  const repoOutHours = sumAdjustedHours(
    legsWithTime
      .filter((l) => l.kind === "REPO")
      .slice(0, repoBuild.legsOut.length)
  )
  const repoBackHours = sumAdjustedHours(
    legsWithTime
      .filter((l) => l.kind === "REPO")
      .slice(repoBuild.legsOut.length)
  )

  const repoLimitReject = enforceRepoConstraints(
    knobs,
    repoOutHours,
    repoBackHours
  )
  if (repoLimitReject) return repoLimitReject

  const matchScore = calcMatchScore(occupiedHours, repoHours)
  const matchCfg = knobs.scoring?.matchScore

  if (logger) {
    const occupiedLegs = legsWithTime.filter((l) => l.kind === "OCCUPIED")
    const repoLegs = legsWithTime.filter((l) => l.kind === "REPO")
    const occRoute = occupiedLegs
      .map((l) => `${l.from.icao} → ${l.to.icao}`)
      .join(", ")
    const repoRoute = repoLegs
      .map((l) => `${l.from.icao} → ${l.to.icao}`)
      .join(", ")
    logger(
      `ℹ️   Engine: Repo: ${repoHours.toFixed(2)}hrs (${
        repoRoute || "—"
      })`
    )
    logger(
      `ℹ️   Engine: Occupied: ${occupiedHours.toFixed(2)}hrs (${
        occRoute || "—"
      })`
    )
    if (typeof matchScore === "number") {
      logger(
        `ℹ️   Engine: Match Score: (${occupiedHours.toFixed(
          2
        )} / (${occupiedHours.toFixed(2)} + ${repoHours.toFixed(
          2
        )})) × 10 = ${matchScore.toFixed(2)}`
      )
    }
  }

  if (matchCfg?.enabled && matchScore !== undefined) {
    if (matchScore < matchCfg.threshold && matchCfg.action === "reject") {
      return reject(
        "MATCH_SCORE_TOO_LOW",
        `Match score ${matchScore.toFixed(2)} < threshold ${
          matchCfg.threshold
        }`,
        "scoring.matchScore.threshold"
      )
    }
  }

  // Feature 6: Daily hour limits as ineligibility
  const dailyLimitReject = checkDailyHourLimits(trip, knobs, legsWithTime)
  if (dailyLimitReject) return dailyLimitReject

  // Calculate base costs - different handling for zone_based pricing
  let base: { baseOccupied: number; baseRepo: number }
  let lineItems: LineItem[] = []
  let finalLegsWithTime = legsWithTime
  let zoneCalculation = undefined

  if (knobs.pricing.rateModel === "zone_based") {
    // Zone-based pricing: calculate per-leg repo costs
    const repoLegsOnly = legsWithTime.filter((l) => l.kind === "REPO")
    const zoneR = calcZoneBasedCost({
      knobs,
      occupiedHours,
      repoLegs: repoLegsOnly,
      departDateISO: trip.departLocalISO,
    })
    if (!zoneR.ok) return zoneR.error

    base = {
      baseOccupied: zoneR.value.baseOccupied,
      baseRepo: zoneR.value.baseRepo,
    }

    // Replace repo legs with enriched versions containing zone metadata
    const occupiedLegsWithTime = legsWithTime.filter((l) => l.kind === "OCCUPIED")
    finalLegsWithTime = [
      ...zoneR.value.enrichedRepoLegs.slice(0, repoBuild.legsOut.length),
      ...occupiedLegsWithTime,
      ...zoneR.value.enrichedRepoLegs.slice(repoBuild.legsOut.length),
    ]

    // Build zone calculation info for output
    zoneCalculation = buildZoneCalculationInfo({
      outboundZone: repoBuild.outZone,
      outboundAirport: repoBuild.chosenOutBase,
      inboundZone: repoBuild.backZone,
      inboundAirport: repoBuild.chosenBackBase,
      config: knobs.repo.zoneNetwork!,
      departDateISO: trip.departLocalISO,
      occupiedRate: knobs.pricing.occupiedRate ?? 0,
    })

    // Add base occupied line item
    lineItems.push({
      code: "BASE_OCCUPIED",
      label: "Base cost (occupied)",
      amount: base.baseOccupied,
      meta: { occupiedHours, appliedRate: zoneCalculation.occupiedRate?.appliedRate },
    })

    // Add zone-based repo line items (detailed per-leg)
    lineItems.push(...zoneR.value.repoLineItems)

    if (logger) {
      logger(
        `ℹ️   Engine: Zone-based pricing | Occupied rate: $${knobs.pricing.occupiedRate}/hr`
      )
      zoneR.value.repoLineItems.forEach((item) => {
        logger(
          `ℹ️   Engine:   ${item.label}: $${item.amount.toFixed(2)}`
        )
      })
    }
  } else {
    // Standard pricing (single_hourly or dual_rate_repo_occupied)
    const baseR = calcBaseCost(knobs, occupiedHours, repoHours)
    if (!baseR.ok) return baseR.error
    base = baseR.value

    if (logger) {
      if (knobs.pricing.rateModel === "single_hourly") {
        logger(
          `ℹ️   Engine: Hourly rate: $${knobs.pricing.hourlyRate}/hr (applied to ALL legs)`
        )
      } else {
        logger(
          `ℹ️   Engine: Repo rate: $${knobs.pricing.repoRate}/hr | Occupied rate: $${knobs.pricing.occupiedRate}/hr`
        )
      }
    }

    lineItems = [
      {
        code: "BASE_OCCUPIED",
        label: "Base cost (occupied)",
        amount: base.baseOccupied,
        meta: { occupiedHours },
      },
      {
        code: "BASE_REPO",
        label: "Base cost (repo)",
        amount: base.baseRepo,
        meta: { repoHours },
      },
    ]
  }

  if (matchCfg?.enabled) {
    lineItems.push({
      code: "INFO_MATCH_SCORE",
      label: "Match score",
      amount: 0,
      meta: { matchScore, ...matchCfg },
    })
  }

  const feeItems = calcFees({ trip, knobs, legs: finalLegsWithTime })
  lineItems.push(...feeItems)
  if (logger && feeItems.length) {
    const totalFees = feeItems.reduce((sum, item) => sum + item.amount, 0)
    logger(
      `ℹ️   Engine: Fees applied: $${totalFees.toFixed(2)} (${
        feeItems.length
      } items)`
    )
  }

  const baseSubtotal = base.baseOccupied + base.baseRepo
  const feesSubtotal = sum(
    lineItems.filter((li) => li.code.startsWith("FEE_")).map((li) => li.amount)
  )
  const totalBeforeDiscount = sum(lineItems.map((li) => li.amount))

  const vhbDiscount = calcVhbDiscount({
    trip,
    knobs,
    vhbCandidates,
    baseSubtotal,
    feesSubtotal,
    totalBeforeDiscount,
  })
  if (vhbDiscount) {
    lineItems.push(vhbDiscount)
    if (logger) {
      logger(`ℹ️   Engine: VHB Discount: ${vhbDiscount.amount.toFixed(2)}`)
    }
  }

  // Feature 2: Time-based discount
  const timeDiscount = calcTimeBasedDiscount({
    knobs,
    legs: finalLegsWithTime,
    baseSubtotal,
    feesSubtotal,
    totalBeforeDiscount: sum(lineItems.map((li) => li.amount)),
  })
  if (timeDiscount) {
    lineItems.push(timeDiscount)
    if (logger) {
      logger(`ℹ️   Engine: Time Discount: ${timeDiscount.amount.toFixed(2)}`)
    }
  }

  // Feature 1: Price constraints (floors & ceilings)
  const occupiedLegCount = finalLegsWithTime.filter(
    (l) => l.kind === "OCCUPIED"
  ).length
  const priceConstraintItems = applyPriceConstraints({
    knobs,
    tentativeTotal: sum(lineItems.map((li) => li.amount)),
    occupiedLegCount,
  })
  if (priceConstraintItems.length > 0) {
    lineItems.push(...priceConstraintItems)
    if (logger) {
      const total = sum(priceConstraintItems.map((item) => item.amount))
      logger(
        `ℹ️   Engine: Price Constraints: ${total.toFixed(2)} (${
          priceConstraintItems.length
        } adjustments)`
      )
    }
  }

  const totals = summarizeTotals(lineItems)
  if (logger) {
    logger(`ℹ️   Engine: FINAL PRICE: $${totals?.total.toFixed(2)}`)
  }

  const overnights =
    trip.tripType === "ROUND_TRIP" && trip.returnLocalISO
      ? computeOvernights(trip.departLocalISO, trip.returnLocalISO)
      : 0

  const calendarDaysTouched = computeCalendarDaysTouched(
    trip.departLocalISO,
    trip.tripType === "ROUND_TRIP" ? trip.returnLocalISO : undefined
  )

  return {
    status: "OK",
    legs: finalLegsWithTime,
    times: {
      occupiedHours,
      repoHours,
      totalHours,
      matchScore,
      overnights,
      calendarDaysTouched,
    },
    lineItems,
    totals,
    zoneCalculation,
  }
}

function buildLegLabel(
  kind: "OCCUPIED" | "REPO",
  index: number,
  firstOccupiedIdx: number,
  lastOccupiedIdx: number,
  occupiedCount: number
) {
  if (kind === "OCCUPIED") {
    if (occupiedCount > 1) {
      if (index === firstOccupiedIdx) return "OCCUPIED OUTBOUND"
      if (index === lastOccupiedIdx) return "OCCUPIED RETURN"
    }
    return "OCCUPIED"
  }
  if (index < firstOccupiedIdx) return "ORIGIN REPO"
  if (index > lastOccupiedIdx) return "DEST REPO"
  return "REPO"
}

function validateBasics(payload: QuoteRequestPayload): QuoteResult | null {
  const { trip, knobs } = payload

  if (trip.tripType === "ROUND_TRIP" && !trip.returnLocalISO) {
    return reject(
      "MISSING_RETURN",
      "returnLocalISO required for ROUND_TRIP",
      "trip.returnLocalISO"
    )
  }

  if (knobs.pricing.rateModel === "single_hourly") {
    if (typeof knobs.pricing.hourlyRate !== "number") {
      return reject(
        "MISSING_RATE",
        "pricing.hourlyRate required for single_hourly",
        "pricing.hourlyRate"
      )
    }
  } else if (knobs.pricing.rateModel === "dual_rate_repo_occupied") {
    if (typeof knobs.pricing.repoRate !== "number") {
      return reject(
        "MISSING_RATE",
        "pricing.repoRate required for dual_rate_repo_occupied",
        "pricing.repoRate"
      )
    }
    if (typeof knobs.pricing.occupiedRate !== "number") {
      return reject(
        "MISSING_RATE",
        "pricing.occupiedRate required for dual_rate_repo_occupied",
        "pricing.occupiedRate"
      )
    }
  } else if (knobs.pricing.rateModel === "zone_based") {
    if (typeof knobs.pricing.occupiedRate !== "number") {
      return reject(
        "MISSING_RATE",
        "pricing.occupiedRate required for zone_based",
        "pricing.occupiedRate"
      )
    }
    if (!knobs.repo.zoneNetwork || knobs.repo.zoneNetwork.zones.length === 0) {
      return reject(
        "MISSING_ZONE_CONFIG",
        "repo.zoneNetwork.zones required for zone_based pricing",
        "repo.zoneNetwork.zones"
      )
    }
    if (knobs.repo.zoneNetwork.zoneRepoRates.length === 0) {
      return reject(
        "MISSING_ZONE_RATES",
        "repo.zoneNetwork.zoneRepoRates required for zone_based pricing",
        "repo.zoneNetwork.zoneRepoRates"
      )
    }
  }

  // Updated: fixedBaseIcao is now an Airport object
  if (knobs.repo.mode === "fixed_base" && !knobs.repo.fixedBaseIcao) {
    return reject(
      "MISSING_BASE",
      "repo.fixedBaseIcao (Airport) required when repo.mode=fixed_base",
      "repo.fixedBaseIcao"
    )
  }

  // If vhb_network, ensure list exists
  if (
    knobs.repo.mode === "vhb_network" &&
    (knobs.repo.vhbSets?.default?.length ?? 0) === 0
  ) {
    return reject(
      "MISSING_VHB_LIST",
      "repo.vhbSets.default must include at least 1 VHB Airport when repo.mode=vhb_network",
      "repo.vhbSets.default"
    )
  }

  // If zone_network, ensure zones exist
  if (
    knobs.repo.mode === "zone_network" &&
    (!knobs.repo.zoneNetwork || knobs.repo.zoneNetwork.zones.length === 0)
  ) {
    return reject(
      "MISSING_ZONE_CONFIG",
      "repo.zoneNetwork.zones required when repo.mode=zone_network",
      "repo.zoneNetwork.zones"
    )
  }

  return null
}
