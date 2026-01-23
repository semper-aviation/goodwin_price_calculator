// engine/eligibility.ts
import { PricingKnobs, TripInput } from "./quoteRequest"
import { QuoteResult, NormalizedLeg } from "./quoteResult"
import { reject, computeOvernights } from "./utils"

export function runEligibilityChecks(
  trip: TripInput,
  knobs: PricingKnobs,
  now: Date
): QuoteResult | null {
  if (knobs.eligibility.domesticOnly) {
    const fromC = (trip.from.country ?? "US").toUpperCase()
    const toC = (trip.to.country ?? "US").toUpperCase()
    if (fromC !== "US" || toC !== "US") {
      return reject(
        "DOMESTIC_ONLY",
        "Trip is not US domestic.",
        "eligibility.domesticOnly"
      )
    }
  }

  if (knobs.eligibility.excludeStates?.length) {
    const excluded = new Set(
      knobs.eligibility.excludeStates.map((s) => s.toUpperCase())
    )
    const fromS = (trip.from.state ?? "").toUpperCase()
    const toS = (trip.to.state ?? "").toUpperCase()
    if ((fromS && excluded.has(fromS)) || (toS && excluded.has(toS))) {
      return reject(
        "STATE_EXCLUDED",
        "Trip touches an excluded state.",
        "eligibility.excludeStates"
      )
    }
  }

  if (typeof knobs.eligibility.maxAdvanceDays === "number") {
    const depart = new Date(trip.departLocalISO)
    const diffDays = (depart.getTime() - now.getTime()) / 86400000
    if (diffDays > knobs.eligibility.maxAdvanceDays + 1e-9) {
      return reject(
        "ADVANCE_TOO_FAR",
        `Departure is ${diffDays.toFixed(0)} days away; max is ${
          knobs.eligibility.maxAdvanceDays
        }.`,
        "eligibility.maxAdvanceDays"
      )
    }
  }

  if (
    typeof knobs.eligibility.maxPassengers === "number" &&
    typeof trip.passengers === "number"
  ) {
    if (trip.passengers > knobs.eligibility.maxPassengers) {
      return reject(
        "PAX_LIMIT",
        `Passengers ${trip.passengers} exceeds max ${knobs.eligibility.maxPassengers}.`,
        "eligibility.maxPassengers"
      )
    }
  }

  if (knobs.eligibility.geoRules?.length) {
    for (const rule of knobs.eligibility.geoRules) {
      if (rule.type === "allowed_countries") {
        const allowed = new Set(rule.countries.map((c) => c.toUpperCase()))
        const fromC = (trip.from.country ?? "").toUpperCase()
        const toC = (trip.to.country ?? "").toUpperCase()
        if ((fromC && !allowed.has(fromC)) || (toC && !allowed.has(toC))) {
          return reject(
            "COUNTRY_NOT_ALLOWED",
            "Trip uses a country not in allowed list.",
            "eligibility.geoRules"
          )
        }
      }

      if (rule.type === "mississippi_rule") {
        const fromSide = trip.from.mississippi_direction
        const toSide = trip.to.mississippi_direction

        if (trip.tripType === "ONE_WAY") {
          const req = rule.oneWayRequires
          const ok =
            (req === "both_east" && fromSide === "EAST" && toSide === "EAST") ||
            (req === "both_west" && fromSide === "WEST" && toSide === "WEST")
          if (!ok)
            return reject(
              "GEO_RULE_FAIL",
              "One-way Mississippi rule failed.",
              "eligibility.geoRules"
            )
        } else {
          if (!trip.returnLocalISO)
            return reject(
              "MISSING_RETURN",
              "returnLocalISO required for ROUND_TRIP",
              "trip.returnLocalISO"
            )
          const overnights = computeOvernights(
            trip.departLocalISO,
            trip.returnLocalISO
          )

          if (overnights <= rule.roundTripUpToNightsRequiresOrigin) {
            const want =
              rule.roundTripUpToNightsSide === "east" ? "EAST" : "WEST"
            if (fromSide !== want) {
              return reject(
                "GEO_RULE_FAIL",
                "Round-trip (short) Mississippi origin-side rule failed.",
                "eligibility.geoRules"
              )
            }
          } else {
            const req = rule.roundTripBeyondNightsRequires
            const ok =
              (req === "both_east" &&
                fromSide === "EAST" &&
                toSide === "EAST") ||
              (req === "both_west" && fromSide === "WEST" && toSide === "WEST")
            if (!ok)
              return reject(
                "GEO_RULE_FAIL",
                "Round-trip (long) Mississippi both-side rule failed.",
                "eligibility.geoRules"
              )
          }
        }
      }

      // Feature 3: Mississippi PPJ Round Trip variations
      if (rule.type === "mississippi_ppj_round_trip") {
        if (!rule.enabled) continue

        const fromSide = trip.from.mississippi_direction
        const toSide = trip.to.mississippi_direction

        if (trip.tripType === "ONE_WAY") {
          // ONE_WAY: BOTH airports must be east
          if (fromSide !== "EAST" || toSide !== "EAST") {
            return reject(
              "GEO_RULE_MISSISSIPPI_PPJ",
              "PPJ one-way requires both airports east of Mississippi.",
              "eligibility.geoRules"
            )
          }
        } else {
          // ROUND_TRIP
          if (!trip.returnLocalISO)
            return reject(
              "MISSING_RETURN",
              "returnLocalISO required for ROUND_TRIP",
              "trip.returnLocalISO"
            )

          const overnights = computeOvernights(
            trip.departLocalISO,
            trip.returnLocalISO
          )

          if (overnights <= 3) {
            // ≤3 nights: Origin must be east (destination can be anywhere)
            if (fromSide !== "EAST") {
              return reject(
                "GEO_RULE_MISSISSIPPI_PPJ",
                "PPJ round trip ≤3 nights requires origin east of Mississippi.",
                "eligibility.geoRules"
              )
            }
          } else {
            // >3 nights: BOTH must be east
            if (fromSide !== "EAST" || toSide !== "EAST") {
              return reject(
                "GEO_RULE_MISSISSIPPI_PPJ",
                "PPJ round trip >3 nights requires both airports east of Mississippi.",
                "eligibility.geoRules"
              )
            }
          }
        }
      }
    }
  }

  return null
}

/**
 * Feature 6: Daily Flight Hour Limits as Ineligibility
 * Checks flight hour constraints after legs are calculated
 */
export function checkDailyHourLimits(
  trip: TripInput,
  knobs: PricingKnobs,
  legs: NormalizedLeg[]
): QuoteResult | null {
  const limits = knobs.time.dailyLimits
  if (!limits?.rejectIfExceeded) return null

  const occupiedLegs = legs.filter((l) => l.kind === "OCCUPIED")

  // Check 1: Any single leg exceeds threshold
  if (typeof limits.rejectIfAnyLegExceeds === "number") {
    for (const leg of occupiedLegs) {
      const actualHours = leg.meta?.actualHours ?? 0
      if (actualHours >= limits.rejectIfAnyLegExceeds) {
        return reject(
          "TIME_DAILY_LIMIT_EXCEEDED",
          `Leg exceeds daily limit: ${actualHours.toFixed(
            1
          )}hrs ≥ ${limits.rejectIfAnyLegExceeds}hrs`,
          "time.dailyLimits.rejectIfAnyLegExceeds"
        )
      }
    }
  }

  // Check 2: Same-day round trip combined exceeds threshold
  if (
    typeof limits.rejectIfSameDayRoundTripExceeds === "number" &&
    trip.tripType === "ROUND_TRIP" &&
    trip.returnLocalISO
  ) {
    const departDate = new Date(trip.departLocalISO).toISOString().split("T")[0]
    const returnDate = new Date(trip.returnLocalISO).toISOString().split("T")[0]

    if (departDate === returnDate) {
      // Same-day round trip
      const totalOccupiedHours = occupiedLegs.reduce(
        (sum, leg) => sum + (leg.meta?.actualHours ?? 0),
        0
      )

      if (totalOccupiedHours >= limits.rejectIfSameDayRoundTripExceeds) {
        return reject(
          "TIME_DAILY_LIMIT_EXCEEDED",
          `Same-day round trip exceeds limit: ${totalOccupiedHours.toFixed(
            1
          )}hrs ≥ ${limits.rejectIfSameDayRoundTripExceeds}hrs`,
          "time.dailyLimits.rejectIfSameDayRoundTripExceeds"
        )
      }
    }
  }

  return null
}
