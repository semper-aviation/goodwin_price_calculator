// engine/discounts.ts
import { Airport, PricingKnobs, TripInput } from "./quoteRequest"
import { LineItem, NormalizedLeg } from "./quoteResult"
import { roundMoney } from "./utils"

export function calcVhbDiscount(args: {
  trip: TripInput
  knobs: PricingKnobs
  vhbCandidates: Airport[]
  baseSubtotal: number
  feesSubtotal: number
  totalBeforeDiscount: number
}): LineItem | null {
  const {
    trip,
    knobs,
    vhbCandidates,
    baseSubtotal,
    feesSubtotal,
    totalBeforeDiscount,
  } = args

  const disc = knobs.discounts.vhbDiscount
  if (!disc || disc.mode === "none" || disc.percent <= 0) return null

  const vhbSet = new Set(vhbCandidates.map((a) => a.icao.toUpperCase()))
  const originIsVhb = vhbSet.has(trip.from.icao.toUpperCase())
  const destIsVhb = vhbSet.has(trip.to.icao.toUpperCase())

  let qualifies = false
  if (disc.mode === "origin_or_destination")
    qualifies = originIsVhb || destIsVhb
  if (disc.mode === "both_required") qualifies = originIsVhb && destIsVhb
  if (!qualifies) return null

  let baseForDiscount = 0
  if (disc.appliesTo === "base_only") baseForDiscount = baseSubtotal
  else if (disc.appliesTo === "subtotal_before_fees")
    baseForDiscount = baseSubtotal + feesSubtotal
  else baseForDiscount = totalBeforeDiscount

  const amount = roundMoney(-1 * baseForDiscount * disc.percent)
  if (amount === 0) return null

  return {
    code: "DISCOUNT_VHB",
    label: "VHB discount",
    amount,
    meta: { ...disc, originIsVhb, destIsVhb, baseForDiscount },
  }
}

/**
 * Feature 2: Time-Based Discounts
 * Applies discount when all occupied legs meet minimum flight time threshold
 */
export function calcTimeBasedDiscount(args: {
  knobs: PricingKnobs
  legs: NormalizedLeg[]
  baseSubtotal: number
  feesSubtotal: number
  totalBeforeDiscount: number
}): LineItem | null {
  const { knobs, legs, baseSubtotal, feesSubtotal, totalBeforeDiscount } = args
  const disc = knobs.discounts.timeBasedDiscount

  if (!disc?.enabled || disc.discountPercent <= 0) return null

  const occupiedLegs = legs.filter((l) => l.kind === "OCCUPIED")

  // ALL occupied legs must meet threshold
  const allQualify = occupiedLegs.every((leg) => {
    const actualHours = leg.meta?.actualHours ?? 0
    return actualHours >= disc.minOccupiedHoursPerLeg
  })

  if (!allQualify) return null

  // Determine base for discount
  let baseForDiscount = 0
  if (disc.appliesTo === "base_only") {
    baseForDiscount = baseSubtotal
  } else if (disc.appliesTo === "subtotal_before_fees") {
    baseForDiscount = baseSubtotal + feesSubtotal
  } else {
    baseForDiscount = totalBeforeDiscount
  }

  const amount = roundMoney(-1 * baseForDiscount * (disc.discountPercent / 100))
  if (amount === 0) return null

  return {
    code: "DISCOUNT_TIME_BASED",
    label: `Time-based discount (${disc.discountPercent}%)`,
    amount,
    meta: {
      ...disc,
      baseForDiscount,
      qualifyingLegs: occupiedLegs.length,
    },
  }
}
