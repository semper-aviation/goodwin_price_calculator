// engine/fees.ts
import { PricingKnobs, TripInput } from "./quoteRequest"
import { LineItem, NormalizedLeg } from "./quoteResult"
import { roundMoney, listDatesTouched, findDailyOverride } from "./utils"

export function calcFees(args: {
  trip: TripInput
  knobs: PricingKnobs
  legs: NormalizedLeg[]
}): LineItem[] {
  const { trip, knobs, legs } = args
  const items: LineItem[] = []

  if (knobs.fees.groundHandling?.perSegmentAmount) {
    const appliesTo = knobs.fees.groundHandling.appliesTo ?? "occupied_only"
    const segments =
      appliesTo === "all_legs"
        ? legs.length
        : legs.filter((l) => l.kind === "OCCUPIED").length
    const amount = roundMoney(
      segments * knobs.fees.groundHandling.perSegmentAmount
    )
    if (amount > 0)
      items.push({
        code: "FEE_GROUND_HANDLING",
        label: "Ground handling",
        amount,
        meta: { segments, appliesTo },
      })
  }

  if (
    knobs.fees.highDensity?.feePerVisit &&
    (knobs.fees.highDensity.airports?.length ?? 0) > 0
  ) {
    const hd = knobs.fees.highDensity
    const hdSet = new Set(hd.airports.map((a) => a.icao.toUpperCase()))
    let visits = 0

    if (hd.countingMode === "segment_endpoints") {
      for (const leg of legs.filter((l) => l.kind === "OCCUPIED")) {
        if (hdSet.has(leg.from.icao.toUpperCase())) visits += 1
        if (hdSet.has(leg.to.icao.toUpperCase())) visits += 1
      }
    } else if (hd.countingMode === "arrivals_only") {
      for (const leg of legs.filter((l) => l.kind === "OCCUPIED")) {
        if (hdSet.has(leg.to.icao.toUpperCase())) visits += 1
      }
    } else if (hd.countingMode === "landings") {
      for (const leg of legs) {
        if (hdSet.has(leg.to.icao.toUpperCase())) visits += 1
      }
    }

    if (trip.tripType === "ROUND_TRIP" && hd.roundTripOriginDoubleCharge) {
      if (hdSet.has(trip.from.icao.toUpperCase())) visits += 1
    }

    let amount = visits * hd.feePerVisit
    if (typeof hd.tripCap === "number") amount = Math.min(amount, hd.tripCap)
    amount = roundMoney(amount)

    if (amount > 0)
      items.push({
        code: "FEE_HIGH_DENSITY",
        label: "High-density airport fees",
        amount,
        meta: { visits },
      })
  }

  if (knobs.fees.landingFees?.defaultAmount) {
    const lf = knobs.fees.landingFees
    const hdSet = new Set(
      (lf.hdAirports ?? []).map((a) => a.icao.toUpperCase())
    )

    let landings = 0
    let amount = 0
    const conditionalLogic = lf.conditionalLogic ?? "standard"

    // Feature 4: Homebase conditional landing count
    if (conditionalLogic === "homebase_conditional" && lf.homebase) {
      const originIsHomebase =
        trip.from.icao.toUpperCase() === lf.homebase.icao.toUpperCase()

      if (originIsHomebase) {
        // 2 landings (occupied legs only)
        const occupiedLegs = legs.filter((l) => l.kind === "OCCUPIED")
        for (const leg of occupiedLegs) {
          landings += 1
          const isHd = hdSet.has(leg.to.icao.toUpperCase())
          amount +=
            isHd && lf.hdOverrideAmount ? lf.hdOverrideAmount : lf.defaultAmount
        }
      } else {
        // 3 landings (1 repo + 2 occupied)
        // This assumes first leg is repo, next legs are occupied
        for (const leg of legs) {
          landings += 1
          const isHd = hdSet.has(leg.to.icao.toUpperCase())
          amount +=
            isHd && lf.hdOverrideAmount ? lf.hdOverrideAmount : lf.defaultAmount
          if (landings >= 3) break
        }
      }
    } else {
      // Standard mode (existing logic)
      const applyToLegs =
        lf.countingMode === "arrivals_only"
          ? legs.filter((l) => l.kind === "OCCUPIED")
          : legs

      for (const leg of applyToLegs) {
        landings += 1
        const isHd = hdSet.has(leg.to.icao.toUpperCase())
        amount +=
          isHd && lf.hdOverrideAmount ? lf.hdOverrideAmount : lf.defaultAmount
      }
    }

    amount = roundMoney(amount)
    if (amount > 0)
      items.push({
        code: "FEE_LANDING",
        label: "Landing fees",
        amount,
        meta: { landings, conditionalLogic },
      })
  }

  if (knobs.fees.overnight && knobs.fees.overnight.appliesWhen !== "none") {
    const ov = knobs.fees.overnight
    const overnights =
      trip.tripType === "ROUND_TRIP" && trip.returnLocalISO
        ? Math.max(
            0,
            Math.round(
              (new Date(trip.returnLocalISO).setHours(0, 0, 0, 0) -
                new Date(trip.departLocalISO).setHours(0, 0, 0, 0)) /
                86400000
            )
          )
        : 0

    const applies =
      ov.appliesWhen === "always" ||
      (ov.appliesWhen === "round_trip_only" && trip.tripType === "ROUND_TRIP")

    if (applies && overnights > 0 && ov.amountPerNight > 0) {
      items.push({
        code: "FEE_OVERNIGHT",
        label: "Overnight fees",
        amount: roundMoney(overnights * ov.amountPerNight),
        meta: { overnights },
      })
    }
  }

  if (knobs.fees.daily?.amountPerCalendarDay) {
    const d = knobs.fees.daily
    const touchedDates = listDatesTouched(
      trip.departLocalISO,
      trip.tripType === "ROUND_TRIP" ? trip.returnLocalISO : undefined
    )

    let total = 0
    for (const date of touchedDates) {
      const o = findDailyOverride(d.dateOverrides ?? [], date)
      total += o ? o.amountPerDay : d.amountPerCalendarDay
    }

    total = roundMoney(total)
    if (total > 0)
      items.push({
        code: "FEE_DAILY",
        label: "Daily fees",
        amount: total,
        meta: { daysTouched: touchedDates.length },
      })
  }

  return items
}
