// engine/index.ts
import type { PricingEngineDeps, QuoteRequestPayload } from "./quoteRequest"
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
import { runEligibilityChecks } from "./eligibility"
import {
  resolveVhbCandidates,
  buildRepoLegs,
  enforceRepoConstraints,
} from "./repo"
import { applyTimeAdjustmentsAndValidate } from "./time"
import { calcBaseCost } from "./pricing"
import { calcFees } from "./fees"
import { calcVhbDiscount } from "./discounts"
import { calcFlightSeconds } from "./flightTime"

export async function quoteEngine(
  payload: QuoteRequestPayload,
  deps: PricingEngineDeps = {}
): Promise<QuoteResult> {
  const now = deps.now?.() ?? new Date()

  const basic = validateBasics(payload)
  if (basic) return basic

  if (payload.trip.tripType === "ROUND_TRIP" && payload.trip.returnLocalISO) {
    const overnights = computeOvernights(
      payload.trip.departLocalISO,
      payload.trip.returnLocalISO
    )
    const splitThreshold = payload.knobs.fees.overnight?.maxNightsBeforeSplit

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

      const out = await quoteOneItinerary(outReq, deps, now)
      if (out.status === "REJECTED") return out

      const back = await quoteOneItinerary(backReq, deps, now)
      if (back.status === "REJECTED") return back

      return sumTwoQuotes(out, back, {
        note: `Split RT into 2 one-ways because overnights (${overnights}) > ${splitThreshold}.`,
      })
    }
  }

  return quoteOneItinerary(payload, deps, now)
}

async function quoteOneItinerary(
  payload: QuoteRequestPayload,
  deps: PricingEngineDeps,
  now: Date
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
    deps.calculateFlightSeconds
  )

  const timeR = applyTimeAdjustmentsAndValidate({
    trip,
    knobs,
    legs: allLegs,
    actualSeconds,
  })
  if (!timeR.ok) return timeR.error
  const { legsWithTime, occupiedHours, repoHours, totalHours } = timeR.value

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

  const baseR = calcBaseCost(knobs, occupiedHours, repoHours)
  if (!baseR.ok) return baseR.error
  const base = baseR.value

  const lineItems: LineItem[] = [
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

  if (matchCfg?.enabled) {
    lineItems.push({
      code: "INFO_MATCH_SCORE",
      label: "Match score",
      amount: 0,
      meta: { matchScore, ...matchCfg },
    })
  }

  lineItems.push(...calcFees({ trip, knobs, legs: legsWithTime }))

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
  if (vhbDiscount) lineItems.push(vhbDiscount)

  const totals = summarizeTotals(lineItems)

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
    legs: legsWithTime,
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
  }
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
  } else {
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

  return null
}
